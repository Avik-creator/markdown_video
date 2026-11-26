import { createRenderPlan } from "@markdown-video/core"
import { describe, expect, it } from "vitest"

import { buildFfmpegArgs } from "./ffmpeg.js"

describe("buildFfmpegArgs", () => {
  it("mirrors browser mp4 encoding semantics through core", () => {
    const plan = createRenderPlan({
      resolution: "1080p",
      projectAspectRatio: "16:9",
      format: "mp4",
      quality: "high",
    })
    const args = buildFfmpegArgs({
      plan,
      format: "mp4",
      quality: "high",
      speed: "balanced",
      fps: 30,
      totalDuration: 8.25,
      outputPath: "out.mp4",
      overwrite: true,
    })

    expect(args).toEqual([
      "-v",
      "error",
      "-y",
      "-f",
      "image2pipe",
      "-framerate",
      "30",
      "-i",
      "pipe:0",
      "-vf",
      "scale=1920:1080:flags=lanczos:out_range=limited,setsar=1",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-t",
      "8.250",
      "out.mp4",
    ])
  })

  it("uses a palette-based gif filter without shell interpolation", () => {
    const plan = createRenderPlan({
      resolution: "480p",
      projectAspectRatio: "16:9",
      format: "gif",
      quality: "high",
    })
    const args = buildFfmpegArgs({
      plan,
      format: "gif",
      quality: "high",
      speed: "balanced",
      fps: 30,
      totalDuration: 2,
      outputPath: "out.gif",
      overwrite: false,
    })

    expect(args).toContain("-n")
    expect(args).toContain("-filter_complex")
    const filter = args[args.indexOf("-filter_complex") + 1]
    expect(filter).toContain("scale=854:480")
    expect(filter).toContain("fps=10")
    expect(filter).toContain("palettegen=max_colors=64")
    expect(filter).toContain("paletteuse")
    expect(args.at(-1)).toBe("out.gif")
  })
})
