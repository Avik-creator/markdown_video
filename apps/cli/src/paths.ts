import { existsSync, statSync } from "node:fs"
import path from "node:path"

import { UsageError } from "./errors.js"

export function resolveInputPath(inputPath: string, cwd: string) {
  if (inputPath === "-") return inputPath
  assertPortablePath(inputPath, "input")
  const resolved = path.resolve(cwd, inputPath)
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    throw new UsageError(`Input markdown file does not exist: ${inputPath}`)
  }
  return resolved
}

function assertPortablePath(value: string, label: string) {
  if (!value || value.trim() !== value || value.includes("\0")) {
    throw new UsageError(`Invalid ${label} path.`)
  }
}

export function expectedOutputExtension(format: string) {
  return format === "gif" ? ".gif" : ".mp4"
}

export function resolveOutputPath({
  outputPath,
  cwd,
  format,
  overwrite,
  allowOutsideCwd,
}: {
  outputPath: string
  cwd: string
  format: string
  overwrite: boolean
  allowOutsideCwd: boolean
}) {
  assertPortablePath(outputPath, "output")
  if (outputPath.endsWith("/") || outputPath.endsWith("\\")) {
    throw new UsageError("Output path must be a file, not a directory.")
  }

  const resolved = path.resolve(cwd, outputPath)
  if (!allowOutsideCwd) {
    const relative = path.relative(cwd, resolved)
    if (
      relative === "" ||
      relative.startsWith("..") ||
      path.isAbsolute(relative)
    ) {
      throw new UsageError(
        "Output path must stay inside the working directory (use --allow-outside-cwd to override).",
      )
    }
  }

  const expectedExtension = expectedOutputExtension(format)
  if (path.extname(resolved).toLowerCase() !== expectedExtension) {
    throw new UsageError(
      `Output path must use ${expectedExtension} for format ${format}.`,
    )
  }

  if (existsSync(resolved)) {
    if (statSync(resolved).isDirectory()) {
      throw new UsageError("Output path must be a file, not a directory.")
    }
    if (!overwrite) {
      throw new UsageError(
        `Output already exists: ${outputPath} (use --overwrite to replace it).`,
      )
    }
  }

  return resolved
}
