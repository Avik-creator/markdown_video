import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { renderVideo } from "../../src/render.js"
import { extractFrame, ffprobeJson } from "./helpers.js"

// Unicode caption burn-in integration tests.
//
// The fixture renders five 1s text scenes at 5fps (25 frames, frame n at t=n/5):
//   scene 1 "Привет"       — Cyrillic (covered by the render host's bundled Inter subsets)
//   scene 2 "Γειά σου"     — Greek (bundled)
//   scene 3 "Tiếng Việt"   — Vietnamese precomposed diacritics (bundled)
//   scene 4 "Emoji 😀 test" — color emoji
//   scene 5 <6 plane-15 PUA codepoints> — guaranteed tofu: no shipped font covers
//                            plane-15 private use, and it is exactly 6 glyphs like
//                            scene 1, so it is the same-length known-tofu baseline.
//
// All scenes share one background and disable transitions, so the bottom caption
// band is the only pixel content that varies — the measured cross-frame noise
// floor of the band is 0.000%, which makes the thresholds below unambiguous.
//
// Tofu detection strategy (tofu boxes ARE pixels, so a naive "non-blank band"
// assertion cannot detect missing glyphs — verified: the PUA caption produces a
// 5.8% burn-vs-control band diff despite rendering pure tofu):
//   1. Golden comparison of the Cyrillic caption frame against a visually
//      verified committed golden. Any tofu form — empty boxes, hex-digit boxes —
//      diffs massively against real glyphs. This is the primary mechanism.
//   2. Same-length tofu comparison: the Cyrillic caption band must differ
//      significantly from the PUA caption band. Chromium renders missing glyphs
//      as repeated identical .notdef boxes (verified visually — no per-codepoint
//      digits), so if "Привет" were tofu its band would be pixel-identical to
//      the same-length PUA band. Residual risk: a platform that renders missing
//      glyphs as hex-digit boxes (a Pango/Firefox behavior Chromium does not
//      implement) could still pass this assertion — the golden covers that case.
//   3. Emoji color: the 😀 caption must contain saturated yellow pixels. Tofu or
//      monochrome fallback glyphs can never be yellow. Requires a color emoji
//      font in the environment — present on macOS (Apple Color Emoji), on CI
//      ubuntu runners (fonts-noto-color-emoji preinstalled), and in the
//      production render-worker image (which installs fonts-noto-color-emoji).
//
// Japanese/Arabic/Hindi are deliberately not asserted here: those scripts fall
// back to system fonts (exactly like scene text always has), and CI runners
// have no CJK coverage, so glyphs would be environment-dependent rather than
// deterministic. The scripts above exercise the bundled-font path plus the
// color-font path, which are the paths this pipeline controls.

const integration = describe.skipIf(process.env.MV_SKIP_INTEGRATION === "1")
const testDir = path.dirname(fileURLToPath(import.meta.url))
const cliDir = path.resolve(testDir, "../..")
const fixturePath = path.join(cliDir, "fixtures/captions-unicode-fixture.md")
const goldensDir = path.join(testDir, "goldens")

// Caption band: the overlay sits bottom-centered; 80–97% of frame height covers
// it with margin while excluding the centered scene text.
const BAND_Y0 = 0.8
const BAND_Y1 = 0.97

const FRAME_SCENE1 = 3 // t=0.6 mid cue 1 (Cyrillic)
const FRAME_SCENE1_LATE = 4 // t=0.8 still cue 1
const FRAME_BOUNDARY = 5 // t=1.0 exactly: cue 1 ends (exclusive), cue 2 starts
const FRAME_SCENE2 = 6 // t=1.2 mid cue 2 (Greek)
const FRAME_SCENE2_LATE = 8 // t=1.6 cue 2
const FRAME_SCENE3 = 13 // t=2.6 cue 3 (Vietnamese)
const FRAME_SCENE4 = 18 // t=3.6 cue 4 (emoji)
const FRAME_SCENE5 = 23 // t=4.6 cue 5 (PUA tofu)

let tempDir = ""
let burnPath = ""
let controlPath = ""
let framesDir = ""

function readPng(filePath: string) {
  return PNG.sync.read(readFileSync(filePath))
}

function framePath(kind: "burn" | "ctrl", frame: number) {
  return path.join(framesDir, `${kind}-${String(frame).padStart(3, "0")}.png`)
}

/** Fraction of pixels in the horizontal caption band that differ beyond noise. */
function bandDiffRatio(
  a: PNG,
  b: PNG,
  y0frac = BAND_Y0,
  y1frac = BAND_Y1,
) {
  expect(a.width).toBe(b.width)
  expect(a.height).toBe(b.height)
  const { width, height } = a
  const y0 = Math.floor(height * y0frac)
  const y1 = Math.floor(height * y1frac)
  let diff = 0
  let total = 0
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const d =
        Math.abs(a.data[i]! - b.data[i]!) +
        Math.abs(a.data[i + 1]! - b.data[i + 1]!) +
        Math.abs(a.data[i + 2]! - b.data[i + 2]!)
      if (d > 30) diff++
      total++
    }
  }
  return diff / total
}

/**
 * Count strongly yellow/orange pixels — the fill color of color-emoji faces.
 * Neither tofu boxes nor monochrome glyph fallback can produce these.
 */
function countYellowish(img: PNG, y0frac = BAND_Y0, y1frac = BAND_Y1) {
  const { width, height } = img
  const y0 = Math.floor(height * y0frac)
  const y1 = Math.floor(height * y1frac)
  let yellow = 0
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = img.data[i]!
      const g = img.data[i + 1]!
      const b = img.data[i + 2]!
      if (r > 180 && g > 120 && g < 220 && b < 100) yellow++
    }
  }
  return yellow
}

function burn(frame: number) {
  return readPng(framePath("burn", frame))
}

function ctrl(frame: number) {
  return readPng(framePath("ctrl", frame))
}

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "mv-cli-captions-"))
  framesDir = path.join(tempDir, "frames")
  burnPath = path.join(tempDir, "burn.mp4")
  controlPath = path.join(tempDir, "control.mp4")
  const markdown = readFileSync(fixturePath, "utf8")
  const shared = {
    markdown,
    cwd: tempDir,
    resolution: "480p",
    quality: "medium",
    speed: "fastest",
    fps: 5,
    overwrite: true,
  } as const
  await renderVideo({ ...shared, outputPath: burnPath, burnCaptions: true })
  await renderVideo({ ...shared, outputPath: controlPath })
  const frames = [
    FRAME_SCENE1,
    FRAME_SCENE1_LATE,
    FRAME_BOUNDARY,
    FRAME_SCENE2,
    FRAME_SCENE2_LATE,
    FRAME_SCENE3,
    FRAME_SCENE4,
    FRAME_SCENE5,
  ]
  for (const frame of frames) {
    await extractFrame(burnPath, frame, framePath("burn", frame))
    await extractFrame(controlPath, frame, framePath("ctrl", frame))
  }
}, 180_000)

afterAll(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

integration("renderVideo caption burn-in integration", () => {
  it("produces an ffprobe-valid h264 mp4 with captions enabled", async () => {
    const info = await ffprobeJson(burnPath)
    const stream = info.streams[0]!
    expect(stream.codec_name).toBe("h264")
    expect(stream.width).toBe(854)
    expect(stream.height).toBe(480)
    expect(Number(stream.nb_frames)).toBe(25)
  }, 30_000)

  it.each([
    ["Cyrillic", FRAME_SCENE1],
    ["Greek", FRAME_SCENE2_LATE],
    ["Vietnamese", FRAME_SCENE3],
    ["emoji", FRAME_SCENE4],
  ])(
    "burns caption pixels into the band for the %s cue",
    (_label, frame) => {
      const ratio = bandDiffRatio(burn(frame), ctrl(frame))
      console.info(`presence frame ${frame}: ${(ratio * 100).toFixed(3)}%`)
      // Measured 3.8–6.0% against a 0.000% noise floor.
      expect(ratio).toBeGreaterThan(0.01)
    },
  )

  it("renders Cyrillic as real glyphs, not tofu boxes", () => {
    // Same-length known-tofu baseline: if the Cyrillic caption were missing-
    // glyph boxes, its band would be pixel-identical to the PUA caption band.
    const ratio = bandDiffRatio(burn(FRAME_SCENE1), burn(FRAME_SCENE5))
    console.info(`cyrillic-vs-tofu band diff: ${(ratio * 100).toFixed(3)}%`)
    // Measured 4.1% against a 0.000% noise floor.
    expect(ratio).toBeGreaterThan(0.01)
  })

  it("renders distinct pixels for distinct caption text", () => {
    const ratio = bandDiffRatio(burn(FRAME_SCENE1), burn(FRAME_SCENE2_LATE))
    console.info(`cyrillic-vs-greek band diff: ${(ratio * 100).toFixed(3)}%`)
    // Measured 1.37% against a 0.000% noise floor.
    expect(ratio).toBeGreaterThan(0.005)
  })

  it("keeps the caption pixel-stable within a cue", () => {
    // Same cue at t=0.6 and t=0.8 — measured 0.000%.
    expect(bandDiffRatio(burn(FRAME_SCENE1), burn(FRAME_SCENE1_LATE))).toBeLessThan(0.001)
    // Same cue straddling the boundary frame — t=1.0 vs t=1.2 both show cue 2.
    expect(bandDiffRatio(burn(FRAME_BOUNDARY), burn(FRAME_SCENE2))).toBeLessThan(0.001)
  })

  it("shows the new cue exactly at the cue boundary (half-open timing)", () => {
    // t=1.0 is simultaneously cue 1's exclusive end and cue 2's inclusive start.
    // The caption must be present (burn vs control)...
    const presence = bandDiffRatio(burn(FRAME_BOUNDARY), ctrl(FRAME_BOUNDARY))
    console.info(`boundary presence: ${(presence * 100).toFixed(3)}%`)
    expect(presence).toBeGreaterThan(0.01)
    // ...it must differ from cue 1's caption at t=0.8 (cue 1 ended — exclusive)...
    const changed = bandDiffRatio(burn(FRAME_SCENE1_LATE), burn(FRAME_BOUNDARY))
    console.info(`boundary change: ${(changed * 100).toFixed(3)}%`)
    expect(changed).toBeGreaterThan(0.005)
    // ...and it must already be cue 2's caption (start — inclusive), which the
    // stability assertion above pins by equality with t=1.2.
  })

  it("renders emoji captions in color, which tofu cannot produce", () => {
    const burnYellow = countYellowish(burn(FRAME_SCENE4))
    const ctrlYellow = countYellowish(ctrl(FRAME_SCENE4))
    console.info(`emoji yellow pixels: burn=${burnYellow} control=${ctrlYellow}`)
    // Measured 102 vs 0.
    expect(burnYellow).toBeGreaterThanOrEqual(20)
    expect(ctrlYellow).toBeLessThanOrEqual(5)
  })

  it("matches the committed Cyrillic caption golden frame perceptually", async () => {
    const actualPath = framePath("burn", FRAME_SCENE1)
    const goldenPath = path.join(goldensDir, "unicode-caption-frame-0003.png")
    const actual = readPng(actualPath)
    const golden = readPng(goldenPath)
    expect(actual.width).toBe(golden.width)
    expect(actual.height).toBe(golden.height)
    const mismatched = pixelmatch(actual.data, golden.data, null, actual.width, actual.height, {
      threshold: 0.18,
      includeAA: false,
    })
    const ratio = mismatched / (actual.width * actual.height)
    console.info(`golden diff unicode-caption-frame-0003.png: ${(ratio * 100).toFixed(3)}%`)
    expect(ratio).toBeLessThan(0.05)
  }, 30_000)
})
