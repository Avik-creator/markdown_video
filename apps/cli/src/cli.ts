#!/usr/bin/env node

import { createRequire } from "node:module"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { parseCliArgs } from "./args.js"
import { UsageError } from "./errors.js"
import { resolveInputPath } from "./paths.js"
import { renderVideo, type RenderProgress } from "./render.js"

const require = createRequire(import.meta.url)
const packageJson = require("../package.json") as { version: string }

const HELP = `markdown-video — render markdown scenes to a video file

Usage:
  markdown-video render <input.md> --output <output.mp4> [options]
  markdown-video render - --output <output.mp4>   # read markdown from stdin
  markdown-video --markdown "# Hello" --output hello.mp4

Options:
  -o, --output <path>        output .mp4 path (or .gif with --format gif)
  -m, --markdown <text>      markdown source instead of an input file
      --resolution <preset>  480p, 720p, 1080p (default), 1440p, or 4k
      --quality <preset>     low, medium, high (default), or ultra
      --speed <preset>       fastest, fast, balanced (default), slow, slowest
      --format <format>      mp4 (default), reels, shorts, slides, or gif
      --aspect-ratio <ratio> project aspect ratio: 16:9 (default), 9:16, 1:1, 4:3
      --locale <code>        localization override used by the scene renderer
      --fps <number>         output frames per second, normalized to 1-60 (default 30)
      --overwrite            replace an existing output file
      --allow-outside-cwd    permit output outside the working directory
      --ffmpeg <path>        ffmpeg executable (default: FFMPEG_BIN or PATH)
      --chromium <path>      Chromium executable (default: Playwright browser)
  -v, --version              print version
  -h, --help                 print this help
`

async function readStdin() {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString("utf8")
}

function createProgressWriter() {
  let lastWritten = -1
  return (progress: RenderProgress) => {
    if (progress.phase !== "capturing" && progress.phase !== "encoding") {
      return
    }
    const percent = Math.floor(progress.percent)
    const shouldWrite =
      progress.phase === "encoding" ||
      percent !== lastWritten &&
        (process.stderr.isTTY || percent % 10 === 0 || progress.frame === progress.totalFrames)
    if (!shouldWrite || percent === lastWritten) return
    lastWritten = percent
    const line = `Rendering frames ${progress.frame}/${progress.totalFrames} (${percent}%)`
    if (process.stderr.isTTY) {
      process.stderr.write(`\r${line}${" ".repeat(Math.max(0, 48 - line.length))}`)
    } else {
      process.stderr.write(`${line}\n`)
    }
  }
}

function finishProgressLine() {
  if (process.stderr.isTTY) process.stderr.write("\n")
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv)
  if (args.help) {
    process.stdout.write(HELP)
    return 0
  }
  if (args.version) {
    process.stdout.write(`${packageJson.version}\n`)
    return 0
  }

  if (!args.outputPath) {
    throw new UsageError("Missing required --output <path>.")
  }
  if (!args.inputPath && args.markdown === null) {
    throw new UsageError("Missing markdown input file, stdin '-', or --markdown.")
  }

  const cwd = process.cwd()
  let markdown: string
  if (args.markdown !== null) {
    markdown = args.markdown
  } else if (args.inputPath === "-") {
    markdown = await readStdin()
  } else {
    const inputPath = resolveInputPath(args.inputPath!, cwd)
    if (path.resolve(cwd, args.outputPath) === inputPath) {
      throw new UsageError("Input and output paths must be different files.")
    }
    markdown = await readFile(inputPath, "utf8")
  }

  const abort = new AbortController()
  const cancel = (signal: NodeJS.Signals) => {
    if (!abort.signal.aborted) {
      process.stderr.write(`\nReceived ${signal}; cancelling render...\n`)
      abort.abort()
    }
  }
  const onSigint = () => cancel("SIGINT")
  const onSigterm = () => cancel("SIGTERM")
  process.once("SIGINT", onSigint)
  process.once("SIGTERM", onSigterm)

  const onProgress = createProgressWriter()
  try {
    const result = await renderVideo({
      markdown,
      outputPath: args.outputPath,
      cwd,
      resolution: args.resolution,
      quality: args.quality,
      speed: args.speed,
      format: args.format,
      aspectRatio: args.aspectRatio,
      locale: args.locale ?? null,
      fps: args.fps,
      overwrite: args.overwrite,
      allowOutsideCwd: args.allowOutsideCwd,
      ffmpegPath: args.ffmpegPath,
      chromiumExecutablePath: args.chromiumExecutablePath,
      signal: abort.signal,
      onProgress,
    })
    finishProgressLine()
    process.stderr.write(
      `Rendered ${result.width}x${result.height} ${result.format} (${result.totalFrames} frames at ${result.fps}fps) in ${result.elapsedSeconds.toFixed(1)}s -> ${result.outputPath}\n`,
    )
    return 0
  } finally {
    finishProgressLine()
    process.off("SIGINT", onSigint)
    process.off("SIGTERM", onSigterm)
  }
}

void main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`markdown-video: ${message}\n`)
    if (error instanceof UsageError) {
      process.stderr.write("Run markdown-video --help for usage.\n")
      process.exitCode = error.exitCode
    } else {
      process.exitCode = 1
    }
  })
