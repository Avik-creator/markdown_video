import { mkdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import { UsageError } from "./errors.js"
import { assertPortablePath } from "./paths.js"
import type { RenderedFrame } from "./render.js"

export interface WritePreviewFramesOptions {
  frames: RenderedFrame[]
  outputDir: string
  cwd: string
  overwrite?: boolean | undefined
  allowOutsideCwd?: boolean | undefined
}

export function resolvePreviewOutputDir({
  outputDir,
  cwd,
  allowOutsideCwd = false,
}: {
  outputDir: string
  cwd: string
  allowOutsideCwd?: boolean | undefined
}) {
  assertPortablePath(outputDir, "output directory")
  const resolved = path.resolve(cwd, outputDir)
  if (!allowOutsideCwd) {
    const relative = path.relative(cwd, resolved)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new UsageError(
        "Preview output directory must stay inside the working directory (use --allow-outside-cwd to override).",
      )
    }
  }
  return resolved
}

export function previewFrameFileName(frame: RenderedFrame, index: number) {
  return `frame-${String(index + 1).padStart(3, "0")}-t${frame.time.toFixed(3)}s.png`
}

/**
 * Write lossless preview PNGs with collision behavior matching video output:
 * existing files are protected unless the caller explicitly passes overwrite.
 * The `wx` flag makes that protection atomic rather than a check-then-write race.
 */
export async function writePreviewFrames({
  frames,
  outputDir,
  cwd,
  overwrite = false,
  allowOutsideCwd = false,
}: WritePreviewFramesOptions) {
  const directory = resolvePreviewOutputDir({
    outputDir,
    cwd,
    allowOutsideCwd,
  })
  const existing = await stat(directory).catch(() => null)
  if (existing && !existing.isDirectory()) {
    throw new UsageError(`Preview output path is not a directory: ${outputDir}`)
  }
  await mkdir(directory, { recursive: true })

  const writtenPaths: string[] = []
  for (const [index, frame] of frames.entries()) {
    const filePath = path.join(directory, previewFrameFileName(frame, index))
    try {
      await writeFile(filePath, frame.png, { flag: overwrite ? "w" : "wx" })
    } catch (error) {
      if (
        !overwrite &&
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST"
      ) {
        throw new UsageError(
          `Preview frame already exists: ${filePath} (use --overwrite to replace it).`,
        )
      }
      throw error
    }
    writtenPaths.push(filePath)
  }
  return writtenPaths
}
