#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const cliDir = path.resolve(scriptDir, "..")
const goldensDir = path.join(cliDir, "tests/integration/goldens")
const tempDir = mkdtempSync(path.join(tmpdir(), "mv-goldens-"))
const videoPath = path.join(tempDir, "fixture.mp4")

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: cliDir,
    stdio: "inherit",
    shell: false,
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

try {
  run(process.execPath, [
    path.join(cliDir, "dist/cli.js"),
    "render",
    "fixtures/render-fixture.md",
    "--output",
    videoPath,
    "--resolution",
    "480p",
    "--quality",
    "medium",
    "--speed",
    "fastest",
    "--fps",
    "12",
    "--overwrite",
    "--allow-outside-cwd",
  ])
  for (const [frame, name] of [
    [12, "scene-1-frame-0012.png"],
    [36, "scene-2-frame-0036.png"],
  ]) {
    run("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-i",
      videoPath,
      "-vf",
      `select=eq(n\\,${frame})`,
      "-frames:v",
      "1",
      path.join(goldensDir, name),
    ])
  }

  // Unicode caption burn-in golden: same 480p/medium/fastest encode path as the
  // test, with --burn-captions enabled. Frame 3 is t=0.6, mid Cyrillic cue.
  // Visually verify the Cyrillic glyphs in this golden before committing it —
  // the golden is the primary tofu-detection mechanism, so it must not bake in
  // missing-glyph boxes.
  const captionsVideoPath = path.join(tempDir, "captions-fixture.mp4")
  run(process.execPath, [
    path.join(cliDir, "dist/cli.js"),
    "render",
    "fixtures/captions-unicode-fixture.md",
    "--output",
    captionsVideoPath,
    "--resolution",
    "480p",
    "--quality",
    "medium",
    "--speed",
    "fastest",
    "--fps",
    "5",
    "--overwrite",
    "--allow-outside-cwd",
    "--burn-captions",
  ])
  run("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    captionsVideoPath,
    "-vf",
    `select=eq(n\\,3)`,
    "-frames:v",
    "1",
    path.join(goldensDir, "unicode-caption-frame-0003.png"),
  ])

  console.log(`Regenerated golden frames in ${goldensDir}`)
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
