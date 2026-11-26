// Browser export machinery helpers. Pure render geometry, frame timing, and
// frame-encoding planning live in @markdown-video/core so the headless CLI can
// share them; this module keeps only capture/ffmpeg/browser lifecycle concerns.

import type { RenderPlan } from "@markdown-video/core"

/**
 * ffmpeg.writeFile transfers Uint8Array buffers to its worker, which neuters
 * the caller's copy. Keep fallbacks and retries independent by copying before
 * the transfer.
 */
export function copyFrameData(frameData: Uint8Array) {
  return frameData.slice()
}

export interface ExportArtifactNames {
  frameDirectory: string
  paletteFileName: string
  outputFileName: string
  musicFileName: string
  captionsFileName: string
  fontDirectory: string
  fontFileName: string
  outputExtension: "mp4" | "gif"
}

/**
 * All mutable files inside ffmpeg's shared MEMFS are generation-scoped. An
 * asynchronous cleanup from an old run can therefore never delete the output
 * or palette belonging to a newer run.
 */
export function getExportArtifactNames(
  generation: number,
  format: string | undefined
): ExportArtifactNames {
  const safeGeneration = Number.isFinite(generation)
    ? Math.max(0, Math.floor(generation))
    : 0
  const outputExtension = format === "gif" ? "gif" : "mp4"

  return {
    frameDirectory: `frames-${safeGeneration}`,
    paletteFileName: `palette-${safeGeneration}.png`,
    outputFileName: `output-${safeGeneration}.${outputExtension}`,
    musicFileName: `music-${safeGeneration}`,
    captionsFileName: `captions-${safeGeneration}.srt`,
    fontDirectory: `fonts-${safeGeneration}`,
    fontFileName: `inter-variable-latin.ttf`,
    outputExtension,
  }
}

/**
 * Apply the deterministic logical layout to html2canvas' cloned scene.
 *
 * Besides pinning width/height, this pins the clone's root font size. Scene
 * captions and most spacing use rem/em units; making the root font size an
 * explicit logical value means browser font settings, preview size, and output
 * resolution cannot independently change caption composition. html2canvas'
 * uniform capture scale still determines the final bitmap size, so a caption's
 * fraction of the video frame is constant at every export resolution.
 */
export function applyRenderLayoutToClone({
  clonedDoc,
  clonedElement,
  renderPlan,
}: {
  clonedDoc: Document
  clonedElement?: HTMLElement | null
  renderPlan: RenderPlan
}) {
  const selector = '[data-scene-preview="true"]'
  const elementIsPreview = clonedElement?.matches?.(selector) === true
  const clonedPreview =
    (elementIsPreview ? clonedElement : null) ??
    (clonedElement?.querySelector?.(selector) as HTMLElement | null) ??
    (clonedDoc.querySelector(selector) as HTMLElement | null)

  if (!clonedPreview) return false

  const logicalFontSize = `${renderPlan.logicalFontSizePx}px`
  clonedDoc.documentElement.style.fontSize = logicalFontSize

  clonedPreview.style.transform = "none"
  clonedPreview.style.width = `${renderPlan.layoutWidth}px`
  clonedPreview.style.height = `${renderPlan.layoutHeight}px`
  clonedPreview.style.aspectRatio = "auto"
  clonedPreview.style.maxWidth = "none"
  clonedPreview.style.maxHeight = "none"
  clonedPreview.style.flexShrink = "0"
  clonedPreview.style.fontSize = logicalFontSize
  // JPEG frames have no alpha channel. Keep the rounded-corner visual on
  // screen, but square the clone so the exported corners are scene pixels
  // rather than black matte.
  clonedPreview.style.borderRadius = "0"
  // Before the first preview fit measurement the live logical frame is hidden
  // to avoid a one-frame broken layout. That transient state must never make
  // an export blank if capture starts during the same commit window.
  clonedPreview.style.visibility = "visible"

  return true
}

type TimeoutHandle = unknown

export interface WarmResourceLease<T> {
  readonly resource: T
  readonly released: boolean
  release: () => void
}

export interface WarmResourceLifecycle<T> {
  acquire: () => WarmResourceLease<T>
  readonly activeLeaseCount: number
  readonly hasResource: boolean
}

/**
 * Reference-counted ownership for an expensive resource that is safe to keep
 * warm only while idle. Reacquisition inside the idle window reuses the same
 * resource; once the last lease has been released for `idleTimeoutMs`, the
 * resource is disposed so the warm optimization cannot become a permanent
 * leak. Lease release is idempotent, preventing one consumer from decrementing
 * the count twice.
 */
export function createWarmResourceLifecycle<T>({
  create,
  dispose,
  idleTimeoutMs,
  setTimeoutFn,
  clearTimeoutFn,
}: {
  create: () => T
  dispose: (resource: T) => void
  idleTimeoutMs: number
  setTimeoutFn?: (callback: () => void, timeoutMs: number) => TimeoutHandle
  clearTimeoutFn?: (handle: TimeoutHandle) => void
}): WarmResourceLifecycle<T> {
  const scheduleTimeout =
    setTimeoutFn ??
    ((callback: () => void, timeoutMs: number) =>
      setTimeout(callback, timeoutMs) as TimeoutHandle)
  const cancelTimeout =
    clearTimeoutFn ??
    ((handle: TimeoutHandle) => {
      clearTimeout(handle as Parameters<typeof clearTimeout>[0])
    })

  let resource: T | null = null
  let activeLeases = 0
  let idleTimer: TimeoutHandle | null = null

  const clearIdleTimer = () => {
    if (idleTimer !== null) {
      cancelTimeout(idleTimer)
      idleTimer = null
    }
  }

  const disposeResource = () => {
    if (resource === null) return
    const current = resource
    resource = null
    dispose(current)
  }

  const scheduleIdleDispose = () => {
    clearIdleTimer()
    idleTimer = scheduleTimeout(() => {
      idleTimer = null
      if (activeLeases === 0) {
        disposeResource()
      }
    }, Math.max(0, idleTimeoutMs))
  }

  return {
    acquire() {
      clearIdleTimer()
      if (resource === null) {
        resource = create()
      }

      const leasedResource = resource
      activeLeases += 1
      let released = false

      return {
        resource: leasedResource,
        get released() {
          return released
        },
        release() {
          if (released) return
          released = true
          activeLeases = Math.max(0, activeLeases - 1)
          if (activeLeases === 0) {
            scheduleIdleDispose()
          }
        },
      }
    },
    get activeLeaseCount() {
      return activeLeases
    },
    get hasResource() {
      return resource !== null
    },
  }
}

let nextRenderGeneration = 1

function allocateRenderGeneration() {
  const generation = nextRenderGeneration
  nextRenderGeneration += 1
  return generation
}

/**
 * Tracks render generations so work belonging to an old run cannot continue
 * or overwrite state after cancellation/reset starts another generation.
 *
 * Generation numbers come from a module-scoped monotonic counter rather than
 * starting at one for every component instance. Artifact names derived from
 * them therefore remain unique across modal close/reopen cycles, so slow
 * asynchronous cleanup from an unmounted run cannot delete a new run's files.
 */
export class RenderRunTracker {
  private generation = 0

  beginRun() {
    this.generation = allocateRenderGeneration()
    return this.generation
  }

  cancelRun(generation?: number) {
    if (generation !== undefined && generation !== this.generation) return
    this.generation = allocateRenderGeneration()
  }

  isCurrent(generation: number) {
    return generation === this.generation
  }
}
