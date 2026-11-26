import {
  ASPECT_RATIO_VALUES,
  EXPORT_FORMAT_VALUES,
  EXPORT_QUALITY_VALUES,
  normalizeOutputFps,
  type AspectRatioType,
  type ExportFormat,
  type ExportQuality,
} from "@markdown-video/core"

import { UsageError } from "./errors.js"

export const EXPORT_SPEED_VALUES = [
  "fastest",
  "fast",
  "balanced",
  "slow",
  "slowest",
] as const
export type ExportSpeed = (typeof EXPORT_SPEED_VALUES)[number]

export const RESOLUTION_VALUES = ["480p", "720p", "1080p", "1440p", "4k"] as const
export type ExportResolution = (typeof RESOLUTION_VALUES)[number]

export interface RenderSettings {
  resolution: ExportResolution
  quality: ExportQuality
  speed: ExportSpeed
  format: ExportFormat
  aspectRatio: AspectRatioType
  locale: string | null
  fps: number
  overwrite: boolean
  allowOutsideCwd: boolean
}

function readChoice<T extends string>(
  value: string | undefined,
  fallback: T,
  allowed: readonly T[],
  optionName: string,
): T {
  if (value === undefined) return fallback
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new UsageError(
    `Invalid ${optionName} "${value}". Expected one of: ${allowed.join(", ")}.`,
  )
}

export function resolveRenderSettings(options: {
  resolution?: string | undefined
  quality?: string | undefined
  speed?: string | undefined
  format?: string | undefined
  aspectRatio?: string | undefined
  locale?: string | null | undefined
  fps?: number | undefined
  overwrite?: boolean | undefined
  allowOutsideCwd?: boolean | undefined
}): RenderSettings {
  if (options.fps !== undefined && !Number.isFinite(options.fps)) {
    throw new UsageError("Invalid --fps value: expected a finite number.")
  }
  if (options.locale != null) {
    if (!/^[\p{L}\p{N}_.-]{1,64}$/u.test(options.locale)) {
      throw new UsageError(
        `Invalid --locale "${options.locale}". Use a locale code such as en, es, or pt-BR.`,
      )
    }
  }

  const fps = normalizeOutputFps(options.fps)
  if (options.fps !== undefined && fps !== Math.round(options.fps)) {
    // normalizeOutputFps intentionally matches editor export semantics: it is
    // a clamping normalizer rather than a strict validator. Keep that behavior
    // for programmatic API parity with core.
  }

  return {
    resolution: readChoice(
      options.resolution,
      "1080p",
      RESOLUTION_VALUES,
      "--resolution",
    ),
    quality: readChoice(
      options.quality,
      "high",
      EXPORT_QUALITY_VALUES,
      "--quality",
    ),
    speed: readChoice(options.speed, "balanced", EXPORT_SPEED_VALUES, "--speed"),
    format: readChoice(options.format, "mp4", EXPORT_FORMAT_VALUES, "--format"),
    aspectRatio: readChoice(
      options.aspectRatio,
      "16:9",
      ASPECT_RATIO_VALUES,
      "--aspect-ratio",
    ),
    locale: options.locale ?? null,
    fps,
    overwrite: options.overwrite ?? false,
    allowOutsideCwd: options.allowOutsideCwd ?? false,
  }
}
