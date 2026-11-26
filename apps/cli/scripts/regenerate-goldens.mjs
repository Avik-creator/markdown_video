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
  console.log(`Regenerated golden frames in ${goldensDir}`)
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
