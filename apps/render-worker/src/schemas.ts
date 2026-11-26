import { z } from "zod"

export const MAX_RENDER_MARKDOWN_CHARS = 100_000
// The MCP schema caps characters, not bytes. Four bytes per character is the
// UTF-8 worst case, so this byte cap is exactly consistent with that input.
export const MAX_RENDER_MARKDOWN_BYTES = MAX_RENDER_MARKDOWN_CHARS * 4
export const MAX_RENDER_REQUEST_BODY_BYTES = 512 * 1024
export const MAX_RENDER_DURATION_SECONDS = 30
export const MAX_RENDER_FPS = 30
export const MAX_RENDER_VIDEO_BYTES = 6 * 1024 * 1024
export const PREVIEW_FRAME_COUNT = 5
export const PREVIEW_RESOLUTION = "720p"

const markdownSchema = z
  .string()
  .min(1)
  .max(MAX_RENDER_MARKDOWN_CHARS)
  .refine(
    (markdown) => Buffer.byteLength(markdown, "utf8") <= MAX_RENDER_MARKDOWN_BYTES,
    `Markdown must not exceed ${MAX_RENDER_MARKDOWN_BYTES} UTF-8 bytes`,
  )

const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1", "4:3"])
const localeSchema = z
  .string()
  .regex(
    /^[\p{L}\p{N}_.-]{1,64}$/u,
    "Use a locale code such as en, es, or pt-BR",
  )
  .nullish()

export const previewRequestSchema = z.strictObject({
  markdown: markdownSchema,
  times: z
    .array(
      z
        .number()
        .finite()
        .nonnegative()
        .max(MAX_RENDER_DURATION_SECONDS),
    )
    .min(3)
    .max(6)
    .optional(),
  aspectRatio: aspectRatioSchema.optional(),
  locale: localeSchema,
})

export const videoOptionsSchema = z.strictObject({
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  quality: z.enum(["low", "medium", "high"]).optional(),
  speed: z.enum(["fastest", "fast", "balanced"]).optional(),
  fps: z.number().int().min(1).max(MAX_RENDER_FPS).optional(),
  aspectRatio: aspectRatioSchema.optional(),
  locale: localeSchema,
})

export const videoRequestSchema = z.strictObject({
  markdown: markdownSchema,
  options: videoOptionsSchema.optional(),
})

export type PreviewRequestInput = z.infer<typeof previewRequestSchema>
export type VideoRequestInput = z.infer<typeof videoRequestSchema>
export type VideoOptionsInput = z.infer<typeof videoOptionsSchema>
