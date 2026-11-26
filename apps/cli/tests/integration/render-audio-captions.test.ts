import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { renderVideo, type RenderVideoResult } from "../../src/render.js"
import { ffprobeJson } from "./helpers.js"

const integration = describe.skipIf(process.env.MV_SKIP_INTEGRATION === "1")

let tempDir = ""
let renderResult: RenderVideoResult

function createSineWaveWav({
  seconds,
  frequency = 440,
  sampleRate = 44_100,
}: {
  seconds: number
  frequency?: number
  sampleRate?: number
}): Buffer {
  const sampleCount = Math.floor(seconds * sampleRate)
  const dataSize = sampleCount * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write("RIFF", 0, "ascii")
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write("WAVE", 8, "ascii")
  buffer.write("fmt ", 12, "ascii")
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write("data", 36, "ascii")
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < sampleCount; index++) {
    const t = index / sampleRate
    const sample = Math.round(Math.sin(2 * Math.PI * frequency * t) * 0.5 * 0x7fff)
    buffer.writeInt16LE(sample, 44 + index * 2)
  }
  return buffer
}

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "mv-cli-audio-captions-"))
  writeFileSync(
    path.join(tempDir, "tone.wav"),
    createSineWaveWav({ seconds: 4 }),
  )
  const markdown = `!music tone.wav volume:0.4 fade:0.5s loop:false

!scene
!duration 1
!text
Hello captions

---

!scene
!duration 1
!text
Second scene
`
  writeFileSync(path.join(tempDir, "input.md"), markdown)

  renderResult = await renderVideo({
    markdown,
    outputPath: "video.mp4",
    cwd: tempDir,
    markdownBaseDir: tempDir,
    resolution: "480p",
    quality: "medium",
    speed: "fastest",
    fps: 5,
    overwrite: true,
  })
}, 120_000)

afterAll(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

integration("renderVideo music and captions integration", () => {
  it("mixes generated sine-wave audio without extending video duration", async () => {
    const info = await ffprobeJson(renderResult.outputPath)
    const video = info.streams.find((stream) => stream.codec_type === "video")
    const audio = info.streams.find((stream) => stream.codec_type === "audio")

    expect(video?.codec_name).toBe("h264")
    expect(audio?.codec_name).toBe("aac")
    expect(Number(info.format.duration)).toBeCloseTo(2, 2)
    expect(renderResult.totalDuration).toBe(2)
    expect(renderResult.hasAudio).toBe(true)
  }, 30_000)

  it("writes exact SRT and WebVTT sidecars next to the output", () => {
    const outputPath = renderResult.outputPath
    const srtPath = path.join(path.dirname(outputPath), "video.srt")
    const vttPath = path.join(path.dirname(outputPath), "video.vtt")

    expect(renderResult.captionCount).toBe(2)
    expect(renderResult.captionPaths).toEqual({ srtPath, vttPath })
    expect(existsSync(srtPath)).toBe(true)
    expect(existsSync(vttPath)).toBe(true)
    expect(readFileSync(srtPath, "utf8")).toBe(`1
00:00:00,000 --> 00:00:01,000
Hello captions

2
00:00:01,000 --> 00:00:02,000
Second scene
`)
    expect(readFileSync(vttPath, "utf8")).toBe(`WEBVTT

00:00:00.000 --> 00:00:01.000
Hello captions

00:00:01.000 --> 00:00:02.000
Second scene
`)
  })
})
