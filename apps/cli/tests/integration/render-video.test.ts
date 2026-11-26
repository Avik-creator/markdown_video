import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { renderVideo, type RenderVideoResult } from "../../src/render.js"
import { extractFrame, ffprobeJson } from "./helpers.js"

const integration = describe.skipIf(process.env.MV_SKIP_INTEGRATION === "1")
const testDir = path.dirname(fileURLToPath(import.meta.url))
const cliDir = path.resolve(testDir, "../..")
const fixturePath = path.join(cliDir, "fixtures/render-fixture.md")
const goldensDir = path.join(testDir, "goldens")

let tempDir = ""
let renderResult: RenderVideoResult
let extractedDir = ""

function readPng(filePath: string) {
  return PNG.sync.read(readFileSync(filePath))
}

function diffRatio(actualPath: string, goldenPath: string) {
  const actual = readPng(actualPath)
  const golden = readPng(goldenPath)
  expect(actual.width).toBe(golden.width)
  expect(actual.height).toBe(golden.height)
  const mismatched = pixelmatch(
    actual.data,
    golden.data,
    null,
    actual.width,
    actual.height,
    { threshold: 0.18, includeAA: false },
  )
  return mismatched / (actual.width * actual.height)
}

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "mv-cli-integration-"))
  extractedDir = path.join(tempDir, "frames")
  const outputPath = path.join(tempDir, "fixture.mp4")
  renderResult = await renderVideo({
    markdown: readFileSync(fixturePath, "utf8"),
    outputPath,
    cwd: tempDir,
    resolution: "480p",
    quality: "medium",
    speed: "fastest",
    fps: 12,
    overwrite: true,
  })
}, 120_000)

afterAll(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

integration("renderVideo integration", () => {
  it("produces an ffprobe-valid h264 mp4", async () => {
    const info = await ffprobeJson(renderResult.outputPath)
    const stream = info.streams[0]!
    expect(stream.codec_name).toBe("h264")
    expect(stream.width).toBe(854)
    expect(stream.height).toBe(480)
    expect(stream.pix_fmt).toBe("yuv420p")
    expect(stream.color_range).toBe("tv")
    expect(stream.r_frame_rate).toBe("12/1")
    expect(stream.avg_frame_rate).toBe("12/1")
    expect(Number(stream.nb_frames)).toBe(48)
    expect(Number(info.format.duration)).toBeCloseTo(4, 2)
    expect(renderResult.totalFrames).toBe(48)
  }, 30_000)

  it.each([
    ["scene-1-frame-0012.png", 12, "scene-1-frame-0012.png"],
    ["scene-2-frame-0036.png", 36, "scene-2-frame-0036.png"],
  ])(
    "matches the committed golden frame %s perceptually",
    async (actualName, frameNumber, goldenName) => {
      const actualPath = path.join(extractedDir, actualName)
      await extractFrame(renderResult.outputPath, frameNumber, actualPath)
      const ratio = diffRatio(actualPath, path.join(goldensDir, goldenName))
      console.info(`golden diff ${goldenName}: ${(ratio * 100).toFixed(3)}%`)
      expect(ratio).toBeLessThan(0.05)
    },
    30_000,
  )
})
