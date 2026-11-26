import { parseMarkdown } from "@markdown-video/core"
import {
  renderFrames,
  renderVideoToBuffer,
  UsageError,
} from "markdown-video"

import { normalizePreviewTimes } from "./preview-times.js"
import {
  MAX_RENDER_DURATION_SECONDS,
  MAX_RENDER_VIDEO_BYTES,
  PREVIEW_FRAME_COUNT,
  PREVIEW_RESOLUTION,
  type PreviewRequestInput,
  type VideoRequestInput,
} from "./schemas.js"

export interface PreviewRenderOutput {
  duration: number
  width: number
  height: number
  frames: Array<{
    time: number
    pngBase64: string
  }>
}

export interface VideoRenderOutput {
  mp4: Buffer
  duration: number
  width: number
  height: number
  fps: number
  totalFrames: number
  sizeBytes: number
  elapsedSeconds: number
}

function totalMarkdownDuration(markdown: string) {
  try {
    return parseMarkdown(markdown).reduce(
      (total, scene) => total + scene.duration,
      0,
    )
  } catch (error) {
    throw new UsageError(
      `Could not parse markdown input: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

function enforceDurationCap(totalDuration: number) {
  if (totalDuration > MAX_RENDER_DURATION_SECONDS) {
    throw new UsageError(
      `Video duration ${totalDuration}s exceeds the ${MAX_RENDER_DURATION_SECONDS}s worker cap.`,
    )
  }
}

export async function renderPreviewJob(
  input: PreviewRequestInput,
  signal: AbortSignal,
): Promise<PreviewRenderOutput> {
  const totalDuration = totalMarkdownDuration(input.markdown)
  enforceDurationCap(totalDuration)
  const times = normalizePreviewTimes(
    input.times,
    totalDuration,
    PREVIEW_FRAME_COUNT,
  )

  const result = await renderFrames({
    markdown: input.markdown,
    times,
    resolution: PREVIEW_RESOLUTION,
    aspectRatio: input.aspectRatio,
    locale: input.locale,
    allowRemoteNetwork: false,
    signal,
  })

  return {
    duration: totalDuration,
    width: result.width,
    height: result.height,
    frames: result.frames.map((frame) => ({
      time: frame.time,
      pngBase64: frame.png.toString("base64"),
    })),
  }
}

export async function renderVideoJob(
  input: VideoRequestInput,
  signal: AbortSignal,
): Promise<VideoRenderOutput> {
  const totalDuration = totalMarkdownDuration(input.markdown)
  enforceDurationCap(totalDuration)
  const options = input.options ?? {}

  const result = await renderVideoToBuffer({
    markdown: input.markdown,
    resolution: options.resolution ?? "720p",
    quality: options.quality ?? "medium",
    speed: options.speed ?? "fast",
    fps: options.fps ?? 24,
    aspectRatio: options.aspectRatio,
    locale: options.locale,
    allowRemoteNetwork: false,
    maxOutputBytes: MAX_RENDER_VIDEO_BYTES,
    signal,
  })

  return {
    mp4: result.mp4,
    duration: result.totalDuration,
    width: result.width,
    height: result.height,
    fps: result.fps,
    totalFrames: result.totalFrames,
    sizeBytes: result.sizeBytes,
    elapsedSeconds: result.elapsedSeconds,
  }
}
