import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { renderVideo } from "./render.js"

let tempDir: string | null = null

function temp() {
  tempDir = mkdtempSync(path.join(tmpdir(), "mv-render-isolation-"))
  return tempDir
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  tempDir = null
})

describe("isolated renderer music policy", () => {
  it("rejects local music before launching Chromium or ffmpeg when remote access is disabled", async () => {
    const dir = temp()
    await expect(renderVideo({
      markdown: `!music secret.wav
!scene
!duration 1
!text
Hi
`,
      outputPath: "out.mp4",
      cwd: dir,
      overwrite: true,
      allowRemoteNetwork: false,
    })).rejects.toThrow("network/file isolated")
  }, 10_000)

  it("rejects remote HTTPS music before network access when isolated", async () => {
    const dir = temp()
    await expect(renderVideo({
      markdown: `!music https://example.com/tone.mp3
!scene
!duration 1
!text
Hi
`,
      outputPath: "out.mp4",
      cwd: dir,
      overwrite: true,
      allowRemoteNetwork: false,
    })).rejects.toThrow("network/file isolated")
  }, 10_000)
})
