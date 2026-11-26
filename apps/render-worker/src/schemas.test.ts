import { describe, expect, it } from "vitest"

import { normalizePreviewTimes, selectPreviewTimes } from "./preview-times.js"
import {
  MAX_RENDER_DURATION_SECONDS,
  MAX_RENDER_MARKDOWN_BYTES,
  MAX_RENDER_VIDEO_BYTES,
  previewRequestSchema,
  videoRequestSchema,
} from "./schemas.js"

const markdown = "!scene\n!duration 2\n!text\nHello"

describe("render worker schemas", () => {
  it("accepts a valid preview request", () => {
    expect(
      previewRequestSchema.parse({
        markdown,
        times: [0, 1, 2],
        aspectRatio: "9:16",
        locale: "pt-BR",
      }),
    ).toMatchObject({ aspectRatio: "9:16", locale: "pt-BR" })
  })

  it("requires three to six preview times when times are supplied", () => {
    expect(
      previewRequestSchema.safeParse({ markdown, times: [0, 1] }).success,
    ).toBe(false)
    expect(
      previewRequestSchema.safeParse({ markdown, times: [0, 1, 2, 3, 4, 5, 6] }).success,
    ).toBe(false)
  })

  it("caps markdown by both characters and UTF-8 bytes", () => {
    expect(
      previewRequestSchema.safeParse({ markdown: "x".repeat(100_001) }).success,
    ).toBe(false)
    expect(MAX_RENDER_MARKDOWN_BYTES).toBe(400_000)
  })

  it("caps video options for the synchronous worker budget", () => {
    expect(MAX_RENDER_DURATION_SECONDS).toBe(30)
    expect(MAX_RENDER_VIDEO_BYTES).toBe(6 * 1024 * 1024)
    expect(
      videoRequestSchema.safeParse({
        markdown,
        options: { resolution: "4k" },
      }).success,
    ).toBe(false)
    expect(
      videoRequestSchema.safeParse({
        markdown,
        options: { fps: 31 },
      }).success,
    ).toBe(false)
  })

  it("rejects unknown input fields instead of silently ignoring them", () => {
    expect(
      videoRequestSchema.safeParse({ markdown, format: "gif" }).success,
    ).toBe(false)
    expect(
      videoRequestSchema.safeParse({
        markdown,
        options: { format: "gif" },
      }).success,
    ).toBe(false)
  })
})

describe("preview time selection", () => {
  it("spreads five default frames inclusively across the duration", () => {
    expect(selectPreviewTimes(8)).toEqual([0, 2, 4, 6, 8])
  })

  it("sorts explicit times and clamps representation noise at the end", () => {
    expect(normalizePreviewTimes([4, 0, 2], 4)).toEqual([0, 2, 4])
  })
})
