import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { resolveInputPath, resolveOutputPath } from "./paths.js"
import { UsageError } from "./errors.js"

let dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "mv-cli-paths-"))
  dirs.push(dir)
  return dir
}

describe("path validation", () => {
  it("resolves an output inside cwd and enforces overwrite", () => {
    const cwd = tempDir()
    const output = resolveOutputPath({
      outputPath: "nested/out.mp4",
      cwd,
      format: "mp4",
      overwrite: false,
      allowOutsideCwd: false,
    })
    expect(output).toBe(path.join(cwd, "nested/out.mp4"))

    writeFileSync(path.join(cwd, "exists.mp4"), "old")
    expect(() =>
      resolveOutputPath({
        outputPath: "exists.mp4",
        cwd,
        format: "mp4",
        overwrite: false,
        allowOutsideCwd: false,
      }),
    ).toThrow(UsageError)
  })

  it("rejects cwd escape unless explicitly allowed", () => {
    const cwd = tempDir()
    expect(() =>
      resolveOutputPath({
        outputPath: "../out.mp4",
        cwd,
        format: "mp4",
        overwrite: false,
        allowOutsideCwd: false,
      }),
    ).toThrow(UsageError)

    expect(() =>
      resolveOutputPath({
        outputPath: "../out.mp4",
        cwd,
        format: "mp4",
        overwrite: true,
        allowOutsideCwd: true,
      }),
    ).not.toThrow()
  })

  it("requires the container extension and validates input existence", () => {
    const cwd = tempDir()
    writeFileSync(path.join(cwd, "input.md"), "# hi")
    expect(resolveInputPath("input.md", cwd)).toBe(path.join(cwd, "input.md"))
    expect(() => resolveInputPath("missing.md", cwd)).toThrow(UsageError)
    expect(() =>
      resolveOutputPath({
        outputPath: "out.mp4",
        cwd,
        format: "gif",
        overwrite: false,
        allowOutsideCwd: false,
      }),
    ).toThrow(UsageError)
  })
})
