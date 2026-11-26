// Export utility functions

import {
  FIXED_RENDER_LAYOUT_WIDTH,
  LOGICAL_ROOT_FONT_SIZE_PX,
  RENDER_LAYOUT_SHORT_SIDE,
  getRenderLayoutDimensions,
  getSceneAspectRatioDimensions,
} from "../../scene-preview/utils/render-layout"

// Keep these names as stable export-utils API for existing callers and tests,
// while the shared render-layout module remains the single implementation.
export {
  FIXED_RENDER_LAYOUT_WIDTH,
  LOGICAL_ROOT_FONT_SIZE_PX,
  RENDER_LAYOUT_SHORT_SIDE,
  getRenderLayoutDimensions,
}

const SHORT_SIDE: Record<string, number> = {
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
  "1440p": 1440,
  "4k": 2160,
}

// libx264 with yuv420p needs even dimensions.
const even = (n: number) => Math.round(n / 2) * 2

/**
 * Output size for a resolution preset and the project's aspect ratio.
 * The preset names the short side, so "1080p" is 1920x1080 at 16:9 and 1080x1920 at 9:16.
 */
export function getExportDimensions(resolution: string, aspectRatio: string = "16:9") {
  const short = SHORT_SIDE[resolution] ?? 1080
  const [w, h] = getSceneAspectRatioDimensions(aspectRatio)
  return w >= h
    ? { width: even((short * w) / h), height: even(short) }
    : { width: even(short), height: even((short * h) / w) }
}

const VERTICAL_EXPORT_FORMATS = new Set(["reels", "shorts"])

/**
 * Resolve the aspect ratio that the output file should have. Vertical social
 * formats are inherently 9:16; all other formats continue to follow the
 * project's configured aspect ratio.
 */
export function getExportAspectRatio(
  format: string | undefined,
  projectAspectRatio: string = "16:9"
) {
  return format && VERTICAL_EXPORT_FORMATS.has(format) ? "9:16" : projectAspectRatio
}

export interface FrameEncoding {
  extension: "jpg"
  mimeType: "image/jpeg"
  quality: number
}

/**
 * JPEG frames are much cheaper to encode and transfer than PNG frames. The
 * final video encode is lossy as well, so use enough JPEG quality that the
 * intermediate frames are not the limiting factor.
 */
export function getFrameEncoding(quality: string): FrameEncoding {
  const jpegQuality: Record<string, number> = {
    low: 0.88,
    medium: 0.92,
    high: 0.95,
    ultra: 0.97,
  }

  return {
    extension: "jpg",
    mimeType: "image/jpeg",
    quality: jpegQuality[quality] ?? jpegQuality.high,
  }
}

export interface RenderPlan {
  width: number
  height: number
  aspectRatio: string
  layoutWidth: number
  layoutHeight: number
  captureScale: number
  logicalFontSizePx: number
  frameExtension: "jpg"
  frameMimeType: "image/jpeg"
  frameQuality: number
  inputPattern: string
}

/**
 * Create the geometry and frame-encoding plan for one export.
 *
 * The DOM layout dimensions are fixed logical coordinates selected by aspect
 * ratio, not by the size of the on-screen preview or the output resolution.
 * For example, landscape 16:9 composes at 1920x1080 and portrait 9:16 at
 * 1080x1920. `captureScale` maps those logical coordinates to the requested
 * raster size, so changing 720p/1080p/4k changes bitmap resolution without
 * changing composition.
 *
 * `layoutHeight` is derived from the exact output-to-layout scale. This keeps
 * the capture mapped exactly onto even output dimensions (notably 480p, whose
 * aspect ratio cannot be represented exactly in even integers) without a
 * second resizing canvas. The small difference from the canonical aspect
 * height remains subpixel after conversion to the output raster.
 */
export function createRenderPlan({
  resolution,
  projectAspectRatio = "16:9",
  format,
  quality = "high",
}: {
  resolution: string
  projectAspectRatio?: string
  format?: string
  quality?: string
}): RenderPlan {
  const aspectRatio = getExportAspectRatio(format, projectAspectRatio)
  const { width, height } = getExportDimensions(resolution, aspectRatio)
  const logicalLayout = getRenderLayoutDimensions(aspectRatio)
  const captureScale = width / logicalLayout.width
  const layoutHeight = height / captureScale
  const frameEncoding = getFrameEncoding(quality)

  return {
    width,
    height,
    aspectRatio,
    layoutWidth: logicalLayout.width,
    layoutHeight,
    captureScale,
    logicalFontSizePx: LOGICAL_ROOT_FONT_SIZE_PX,
    frameExtension: frameEncoding.extension,
    frameMimeType: frameEncoding.mimeType,
    frameQuality: frameEncoding.quality,
    inputPattern: `frame%05d.${frameEncoding.extension}`,
  }
}

export function getFrameFileName(index: number, extension: string) {
  return `frame${String(index).padStart(5, "0")}.${extension}`
}

/**
 * ffmpeg.writeFile transfers Uint8Array buffers to its worker, which neuters
 * the caller's copy. Keep fallbacks and retries independent by copying before
 * the transfer.
 */
export function copyFrameData(frameData: Uint8Array) {
  return frameData.slice()
}

/** Match the renderer's existing fps semantics: falsy means the 30fps default. */
export function normalizeOutputFps(fps: number | undefined) {
  return Math.min(60, Math.max(1, Math.round(fps || 30)))
}

/**
 * Frame counts are ceiling(duration * fps), but the multiplication can land
 * one ulp above a mathematically integral frame count — 8.3 * 30 is
 * 249.00000000000003 in floating point — and a naive ceil then renders one
 * extra frame. Durations only carry millisecond precision, so a billionth of
 * a frame is always representation noise, never signal: subtract it before
 * rounding up. Genuinely fractional counts (4.15s at 30fps = 124.5) are
 * unaffected because their fraction is many orders of magnitude larger.
 */
function frameCountFor(duration: number, fps: number) {
  return Math.ceil(duration * fps - 1e-9)
}

export function getTotalFrameCount(
  totalDuration: number,
  fps: number | undefined
) {
  return frameCountFor(totalDuration, normalizeOutputFps(fps))
}

export interface ExportValidationResult {
  valid: boolean
  reason: string | null
  outputFps: number
  totalFrameCount: number
}

/**
 * Validate the inputs before touching ffmpeg. In particular, ffmpeg's image
 * sequence demuxer must never be invoked for a zero-length/invalid sequence.
 */
export function validateExportInput({
  sceneCount,
  totalDuration,
  fps,
}: {
  sceneCount: number
  totalDuration: number
  fps?: number
}): ExportValidationResult {
  const outputFps = normalizeOutputFps(fps)
  const totalFrameCount = frameCountFor(totalDuration, outputFps)

  if (!Number.isInteger(sceneCount) || sceneCount <= 0) {
    return {
      valid: false,
      reason: "Add at least one scene before exporting.",
      outputFps,
      totalFrameCount,
    }
  }

  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    return {
      valid: false,
      reason: "Video duration must be greater than zero before exporting.",
      outputFps,
      totalFrameCount,
    }
  }

  if (!Number.isFinite(totalFrameCount) || totalFrameCount <= 0) {
    return {
      valid: false,
      reason: "Export would produce an invalid frame sequence.",
      outputFps,
      totalFrameCount,
    }
  }

  return {
    valid: true,
    reason: null,
    outputFps,
    totalFrameCount,
  }
}

export interface ExportArtifactNames {
  frameDirectory: string
  paletteFileName: string
  outputFileName: string
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
