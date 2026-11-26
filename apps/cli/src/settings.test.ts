import { describe, expect, it } from "vitest"

import { UsageError } from "./errors.js"
import { resolveRenderSettings } from "./settings.js"

describe("resolveRenderSettings", () => {
  it("uses editor-compatible defaults", () => {
    expect(resolveRenderSettings({})).toEqual({
      resolution: "1080p",
      quality: "high",
      speed: "balanced",
      format: "mp4",
      aspectRatio: "16:9",
      locale: null,
      fps: 30,
      overwrite: false,
      allowOutsideCwd: false,
    })
  })

  it("normalizes fps using core export semantics", () => {
    expect(resolveRenderSettings({ fps: 59.6 }).fps).toBe(60)
    expect(resolveRenderSettings({ fps: 0 }).fps).toBe(30)
  })

  it("rejects unknown enum values loudly", () => {
    expect(() => resolveRenderSettings({ quality: "lossless" })).toThrow(
      UsageError,
    )
    expect(() => resolveRenderSettings({ aspectRatio: "21:9" })).toThrow(
      UsageError,
    )
  })
})
