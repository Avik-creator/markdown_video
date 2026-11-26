// Pure render geometry, frame timing, and frame-encoding planning.
// These calculations are shared by browser export and the future headless CLI;
// capture, DOM mutation, ffmpeg MEMFS, and process lifecycle machinery stay in
// the consuming application.

import {
  LOGICAL_ROOT_FONT_SIZE_PX,
  getRenderLayoutDimensions,
  getSceneAspectRatioDimensions,
} from "./render-layout"

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
