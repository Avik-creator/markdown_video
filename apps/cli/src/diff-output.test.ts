import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  diffComparisonImageFileName,
  prepareDiffOutputDir,
  resolveDiffOutputDir,
  writeDiffComparisonImage,
} from "./diff-output.js"
import { UsageError } from "./errors.js"

let tempDir: string | null = null

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  tempDir = null
})

function makeTempDir() {
  tempDir = mkdtempSync(path.join(tmpdir(), "mv-diff-output-test-"))
  return tempDir
}

describe("diff output paths", () => {
  it("keeps output directories inside cwd unless explicitly allowed", () => {
    const cwd = makeTempDir()
    expect(resolveDiffOutputDir({ outputDir: "frames", cwd })).toBe(path.join(cwd, "frames"))
    expect(() => resolveDiffOutputDir({ outputDir: "../frames", cwd })).toThrow(UsageError)
    expect(resolveDiffOutputDir({ outputDir: "../frames", cwd, allowOutsideCwd: true })).toBe(
      path.resolve(cwd, "../frames"),
    )
  })

  it("uses deterministic one-based scene and sample file names", () => {
    expect(diffComparisonImageFileName({ oldIndex: 0, newIndex: 2, sampleIndex: 0 })).toBe(
      "scene-o001-n003-sample-01.png",
    )
  })

  it("protects existing comparison images unless overwrite is enabled", async () => {
    const cwd = makeTempDir()
    const directory = await prepareDiffOutputDir({ outputDir: "frames", cwd })
    const fileName = diffComparisonImageFileName({ oldIndex: 0, newIndex: 0, sampleIndex: 0 })
    writeFileSync(path.join(directory, fileName), "existing")

    await expect(
      writeDiffComparisonImage({ png: Buffer.from("new"), directory, fileName }),
    ).rejects.toThrow(UsageError)

    await writeDiffComparisonImage({
      png: Buffer.from("new"),
      directory,
      fileName,
      overwrite: true,
    })
  })
})
