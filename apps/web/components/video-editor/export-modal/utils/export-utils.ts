// Browser export machinery helpers. Pure render geometry, frame timing, and
// frame-encoding planning live in @markdown-video/core so the headless CLI can
// share them; this module keeps only capture/ffmpeg/browser lifecycle concerns.

import {
  getVideoEncodingSettings,
  type RenderPlan,
  type VideoEncodingSettings,
} from "@markdown-video/core"

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
  webcodecsVideoFileName: string
  outputExtension: "mp4" | "gif"
}

/**
 * All mutable files inside ffmpeg's shared MEMFS are generation-scoped. An
 * asynchronous cleanup from an old run can therefore never delete the output
 * or palette belonging to a newer run.
 *
 * Captions deliberately have no MEMFS artifacts: burn-in is DOM-composited
 * into the captured frames themselves and sidecar downloads are blob URLs
 * built directly from the generated text, so no caption or font file ever
 * enters the ffmpeg filesystem.
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
    webcodecsVideoFileName: `webcodecs-video-${safeGeneration}.mp4`,
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

  clonedDoc.documentElement.style.fontSize = `${renderPlan.logicalFontSizePx}px`
  writeRenderLayoutStyles(clonedPreview, renderPlan)

  return true
}

/**
 * The pinned styles applyRenderLayoutToClone and applyRenderLayoutToElement
 * share, so the html2canvas clone and the live snapdom capture target can
 * never drift apart.
 */
function writeRenderLayoutStyles(element: HTMLElement, renderPlan: RenderPlan) {
  const logicalFontSize = `${renderPlan.logicalFontSizePx}px`
  element.style.transform = "none"
  element.style.width = `${renderPlan.layoutWidth}px`
  element.style.height = `${renderPlan.layoutHeight}px`
  element.style.aspectRatio = "auto"
  element.style.maxWidth = "none"
  element.style.maxHeight = "none"
  element.style.flexShrink = "0"
  element.style.fontSize = logicalFontSize
  // JPEG frames have no alpha channel. Keep the rounded-corner visual on
  // screen, but square the frame so the exported corners are scene pixels
  // rather than black matte.
  element.style.borderRadius = "0"
  // Before the first preview fit measurement the live logical frame is hidden
  // to avoid a one-frame broken layout. That transient state must never make
  // an export blank if capture starts during the same commit window.
  element.style.visibility = "visible"
}

const RENDER_LAYOUT_STYLE_KEYS = [
  "transform",
  "width",
  "height",
  "aspectRatio",
  "maxWidth",
  "maxHeight",
  "flexShrink",
  "fontSize",
  "borderRadius",
  "visibility",
] as const

/**
 * Apply the deterministic logical layout to the live preview element.
 *
 * snapdom measures the real element's box before cloning, so the html2canvas
 * onclone trick cannot fix its geometry — the live preview itself must take
 * the logical layout for the run. The export dialog covers the preview
 * meanwhile. Returns a restore function that puts back the exact previous
 * inline styles (idempotent).
 */
export function applyRenderLayoutToElement(
  element: HTMLElement,
  renderPlan: RenderPlan
): () => void {
  const saved = {} as Record<(typeof RENDER_LAYOUT_STYLE_KEYS)[number], string>
  for (const key of RENDER_LAYOUT_STYLE_KEYS) saved[key] = element.style[key]
  writeRenderLayoutStyles(element, renderPlan)
  let restored = false
  return () => {
    if (restored) return
    restored = true
    for (const key of RENDER_LAYOUT_STYLE_KEYS) element.style[key] = saved[key]
  }
}

/**
 * Re-assert the logical layout on the live preview if React or a resize
 * overwrote it between frames. A cheap compare of the three properties the
 * editor's fit code touches; the full style set is rewritten only on drift.
 * Returns true when it re-applied.
 */
export function ensureRenderLayout(
  element: HTMLElement,
  renderPlan: RenderPlan
): boolean {
  if (
    element.style.transform === "none" &&
    element.style.width === `${renderPlan.layoutWidth}px` &&
    element.style.height === `${renderPlan.layoutHeight}px`
  ) {
    return false
  }
  writeRenderLayoutStyles(element, renderPlan)
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

// The shared preset scale in @markdown-video/core assumes a native,
// multi-threaded x264. The browser runs a single-threaded wasm build where a
// "slow" preset can take tens of minutes on a 30-second clip, so the browser
// scale is shifted two steps faster while keeping the same CRF for each
// quality level. Native CLI encodes keep the unshifted table.
const BROWSER_PRESET_BY_SPEED: Record<string, string> = {
  fastest: "ultrafast",
  fast: "superfast",
  balanced: "veryfast",
  slow: "faster",
  slowest: "fast",
}

export function getBrowserVideoEncodingSettings(
  quality: string,
  speed: string
): VideoEncodingSettings {
  return {
    preset: BROWSER_PRESET_BY_SPEED[speed] ?? BROWSER_PRESET_BY_SPEED.balanced,
    crf: getVideoEncodingSettings(quality, speed).crf,
  }
}

/**
 * ffmpeg.wasm reports encode progress as an output timestamp in microseconds.
 * Deriving the percent from that output timestamp rather than the reported
 * `progress` fraction keeps it honest for image-sequence inputs, whose input
 * duration metadata is unreliable. Clamped to 99 while running; callers set
 * 100 only after the exec call resolves.
 */
export function computeEncodeProgressPercent(
  timeUs: number,
  totalDurationSec: number
): number {
  if (
    !Number.isFinite(timeUs) ||
    !Number.isFinite(totalDurationSec) ||
    totalDurationSec <= 0
  ) {
    return 0
  }
  const percent = (timeUs / 1_000_000 / totalDurationSec) * 100
  if (percent < 0) return 0
  return Math.min(99, Math.floor(percent))
}

/** Compact remaining-time label: "45s", "3m 10s", "1h 2m". */
export function formatEta(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ""
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) {
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

/**
 * Per-frame capture timing. Keeps a bounded recent window so the ETA tracks
 * scene-to-scene cost changes instead of averaging the whole run. Returns no
 * estimate until `minSamples` frames have completed so the first seconds of a
 * run do not show a meaningless ETA.
 */
export function createFrameTimeEstimator({
  windowSize = 20,
  minSamples = 5,
}: {
  windowSize?: number
  minSamples?: number
} = {}) {
  const frameTimes: number[] = []

  return {
    addFrame(durationMs: number) {
      if (!Number.isFinite(durationMs) || durationMs < 0) return
      frameTimes.push(durationMs)
      if (frameTimes.length > windowSize) {
        frameTimes.splice(0, frameTimes.length - windowSize)
      }
    },
    estimateRemainingMs(remainingFrames: number): number | null {
      if (
        frameTimes.length < minSamples ||
        !Number.isFinite(remainingFrames) ||
        remainingFrames <= 0
      ) {
        return null
      }
      const average =
        frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length
      return average * remainingFrames
    },
    get sampleCount() {
      return frameTimes.length
    },
  }
}

/**
 * Races a promise against a watchdog deadline. Used for per-frame capture:
 * a frame that exceeds the budget counts as a capture failure and feeds the
 * existing consecutive-failure ceiling. The timer is cleared on settle so the
 * watchdog cannot fire after the work already finished.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  createError: () => Error
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(createError()), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export const BACKGROUND_TAB_PAUSE_MESSAGE =
  "Paused — this tab is in the background. Return to it to continue."

export function getBackgroundTabPauseMessage(
  visibilityState: string
): string | null {
  return visibilityState === "hidden" ? BACKGROUND_TAB_PAUSE_MESSAGE : null
}

export type ExportEncoderKind = "webcodecs" | "ffmpeg"

/**
 * Which encoder produces the output video stream. WebCodecs is only an option
 * for MP4-family exports (mp4, reels, shorts — all H.264 in MP4) when the
 * browser accepted a config; GIF keeps the two-pass ffmpeg.wasm pipeline.
 */
export function chooseExportEncoder({
  format,
  webCodecsConfig,
}: {
  format: string | undefined
  webCodecsConfig: unknown
}): ExportEncoderKind {
  if (format !== "gif" && webCodecsConfig != null) return "webcodecs"
  return "ffmpeg"
}

/** sessionStorage flag set when the WebCodecs encoder fails mid-export. */
export const WEBCODECS_EXPORT_DISABLED_KEY =
  "markdown-video:webcodecs-export-disabled"

/**
 * True once a WebCodecs encode has failed at runtime in this tab. Read before
 * every export so Try Again falls back to the ffmpeg.wasm pipeline; scoped to
 * the tab session so a fresh session is allowed to try the hardware again.
 * Any storage error (private mode, disabled storage) means "not disabled".
 */
export function isWebCodecsExportDisabled(): boolean {
  try {
    return sessionStorage.getItem(WEBCODECS_EXPORT_DISABLED_KEY) === "1"
  } catch {
    return false
  }
}

/** Remember a runtime WebCodecs failure for the rest of this tab session. */
export function disableWebCodecsExport(): void {
  try {
    sessionStorage.setItem(WEBCODECS_EXPORT_DISABLED_KEY, "1")
  } catch {
    // Storage can be unavailable; the failure is still reported, the flag is best-effort.
  }
}

/** sessionStorage flag set when snapdom frame capture fails mid-export. */
export const SNAPDOM_CAPTURE_DISABLED_KEY =
  "markdown-video:snapdom-capture-disabled"

/**
 * True once snapdom capture has failed at runtime in this tab. Read before
 * every export so Try Again falls back to the html2canvas renderer; scoped to
 * the tab session so a fresh session is allowed to try snapdom again.
 * Any storage error (private mode, disabled storage) means "not disabled".
 */
export function isSnapdomCaptureDisabled(): boolean {
  try {
    return sessionStorage.getItem(SNAPDOM_CAPTURE_DISABLED_KEY) === "1"
  } catch {
    return false
  }
}

/** Remember a runtime snapdom capture failure for the rest of this tab session. */
export function disableSnapdomCapture(): void {
  try {
    sessionStorage.setItem(SNAPDOM_CAPTURE_DISABLED_KEY, "1")
  } catch {
    // Storage can be unavailable; the failure is still reported, the flag is best-effort.
  }
}
