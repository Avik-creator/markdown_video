import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { UsageError } from "./errors.js"
import {
  previewFrameFileName,
  resolvePreviewOutputDir,
  writePreviewFrames,
} from "./preview-output.js"

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const frames = [
  { time: 0, png },
  { time: 1.5, png },
]

let tempDirs: string[] = []

function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "mv-preview-output-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  tempDirs = []
})

describe("preview output files", () => {
  it("uses stable numbered exact-time file names", () => {
    expect(previewFrameFileName(frames[0]!, 0)).toBe("frame-001-t0.000s.png")
    expect(previewFrameFileName(frames[1]!, 1)).toBe("frame-002-t1.500s.png")
  })

  it("writes PNG bytes inside a cwd-confined output directory", async () => {
    const cwd = tempDir()
    const written = await writePreviewFrames({
      frames,
      outputDir: "previews",
      cwd,
    })

    expect(written).toHaveLength(2)
    expect(written.every((filePath) => filePath.startsWith(cwd))).toBe(true)
    expect(readFileSync(written[0]!)).toEqual(png)
  })

  it("rejects an output directory outside cwd without the explicit override", () => {
    const cwd = tempDir()
    expect(() =>
      resolvePreviewOutputDir({ outputDir: "../outside", cwd }),
    ).toThrow(UsageError)
    expect(() =>
      resolvePreviewOutputDir({
        outputDir: "../outside",
        cwd,
        allowOutsideCwd: true,
      }),
    ).not.toThrow()
  })

  it("protects existing frames unless overwrite is enabled", async () => {
    const cwd = tempDir()
    const first = await writePreviewFrames({ frames, outputDir: "previews", cwd })
    writeFileSync(first[0]!, "keep")

    await expect(
      writePreviewFrames({ frames, outputDir: "previews", cwd }),
    ).rejects.toThrow(UsageError)
    expect(readFileSync(first[0]!, "utf8")).toBe("keep")

    await writePreviewFrames({
      frames,
      outputDir: "previews",
      cwd,
      overwrite: true,
    })
    expect(readFileSync(first[0]!)).toEqual(png)
  })
})
