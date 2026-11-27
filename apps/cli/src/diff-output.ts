import { mkdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import { UsageError } from "./errors.js"
import { assertPortablePath } from "./paths.js"

export function resolveDiffOutputDir({
  outputDir,
  cwd,
  allowOutsideCwd = false,
}: {
  outputDir: string
  cwd: string
  allowOutsideCwd?: boolean | undefined
}) {
  assertPortablePath(outputDir, "diff output directory")
  const resolved = path.resolve(cwd, outputDir)
  if (!allowOutsideCwd) {
    const relative = path.relative(cwd, resolved)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new UsageError(
        "Diff output directory must stay inside the working directory (use --allow-outside-cwd to override).",
      )
    }
  }
  return resolved
}

export async function prepareDiffOutputDir({
  outputDir,
  cwd,
  allowOutsideCwd = false,
}: {
  outputDir: string
  cwd: string
  allowOutsideCwd?: boolean | undefined
}) {
  const directory = resolveDiffOutputDir({ outputDir, cwd, allowOutsideCwd })
  const existing = await stat(directory).catch(() => null)
  if (existing && !existing.isDirectory()) {
    throw new UsageError(`Diff output path is not a directory: ${outputDir}`)
  }
  await mkdir(directory, { recursive: true })
  return directory
}

export function diffComparisonImageFileName({
  oldIndex,
  newIndex,
  sampleIndex,
}: {
  oldIndex: number
  newIndex: number
  sampleIndex: number
}) {
  const oldPart = String(oldIndex + 1).padStart(3, "0")
  const newPart = String(newIndex + 1).padStart(3, "0")
  const samplePart = String(sampleIndex + 1).padStart(2, "0")
  return `scene-o${oldPart}-n${newPart}-sample-${samplePart}.png`
}

/** Write one comparison image with the same atomic no-clobber semantics as preview frames. */
export async function writeDiffComparisonImage({
  png,
  directory,
  fileName,
  overwrite = false,
}: {
  png: Buffer
  directory: string
  fileName: string
  overwrite?: boolean | undefined
}) {
  const filePath = path.join(directory, fileName)
  try {
    await writeFile(filePath, png, { flag: overwrite ? "w" : "wx" })
  } catch (error) {
    if (
      !overwrite &&
      error instanceof Error &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new UsageError(
        `Diff comparison image already exists: ${filePath} (use --overwrite to replace it).`,
      )
    }
    throw error
  }
  return filePath
}
