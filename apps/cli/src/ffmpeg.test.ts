import { createRenderPlan } from "@markdown-video/core"
import { describe, expect, it } from "vitest"

import { buildFfmpegArgs } from "./ffmpeg.js"

function mp4Plan() {
  return createRenderPlan({
    resolution: "1080p",
    projectAspectRatio: "16:9",
    format: "mp4",
    quality: "high",
  })
}

describe("buildFfmpegArgs", () => {
  it("mirrors browser mp4 encoding semantics through core", () => {
    const args = buildFfmpegArgs({
      plan: mp4Plan(),
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
      "-c:v",
      "mjpeg",
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

  it("adds music as a separate input with explicit stream mapping and no shell interpolation", () => {
    const args = buildFfmpegArgs({
      plan: mp4Plan(),
      format: "mp4",
      quality: "high",
      speed: "balanced",
      fps: 30,
      totalDuration: 5,
      outputPath: "out.mp4",
      overwrite: true,
      music: {
        inputPath: "music file.mp3",
        volume: 0.4,
        fade: 1,
        loop: true,
      },
    })

    expect(args).toEqual([
      "-v",
      "error",
      "-y",
      "-f",
      "image2pipe",
      "-c:v",
      "mjpeg",
      "-framerate",
      "30",
      "-i",
      "pipe:0",
      "-stream_loop",
      "-1",
      "-i",
      "music file.mp3",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-af",
      "volume=0.4,atrim=duration=5,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1,afade=t=out:st=4:d=1",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
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
      "5.000",
      "out.mp4",
    ])
  })

  it("does not use shell-sensitive caption paths in burn-in filters", () => {
    const args = buildFfmpegArgs({
      plan: mp4Plan(),
      format: "mp4",
      quality: "high",
      speed: "balanced",
      fps: 30,
      totalDuration: 5,
      outputPath: "out.mp4",
      overwrite: true,
      burnCaptionsFileName: "captions.srt",
    })

    const filter = args[args.indexOf("-vf") + 1]
    expect(filter).toBe(
      "scale=1920:1080:flags=lanczos:out_range=limited,setsar=1,subtitles=captions.srt",
    )
    expect(() =>
      buildFfmpegArgs({
        plan: mp4Plan(),
        format: "mp4",
        quality: "high",
        speed: "balanced",
        fps: 30,
        totalDuration: 5,
        outputPath: "out.mp4",
        overwrite: true,
        burnCaptionsFileName: "captions.srt,ass=evil",
      }),
    ).toThrow("captions filename")
  })

  it("omits music inputs for gif because the container cannot carry audio", () => {
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
      music: {
        inputPath: "tone.wav",
        volume: 0.4,
        fade: 1,
        loop: true,
      },
    })

    expect(args).not.toContain("tone.wav")
    expect(args).not.toContain("-stream_loop")
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

  it("can burn captions into gif frames through the fixed sidecar filename", () => {
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
      burnCaptionsFileName: "captions.srt",
    })

    const filter = args[args.indexOf("-filter_complex") + 1]
    expect(filter).toContain("fps=10,subtitles=captions.srt,split")
  })
})
