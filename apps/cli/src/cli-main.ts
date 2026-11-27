import { createRequire } from "node:module"
import { readFile } from "node:fs/promises"
import path from "node:path"

import {
  parseCliArgs,
  parseDoctorCliArgs,
  parseInstallBrowserCliArgs,
} from "./args.js"
import { installPlaywrightChromium } from "./browser.js"
import { formatDoctorReport, runDoctorChecks } from "./doctor.js"
import { UsageError } from "./errors.js"
import { resolveInputPath } from "./paths.js"
import { renderVideo, type RenderProgress } from "./render.js"

const require = createRequire(import.meta.url)
const packageJson = require("../package.json") as { version: string }

const HELP = `markdown-video — render markdown scenes to MP4 or GIF

Usage:
  markdown-video render <input.md> --output <output.mp4> [options]
  markdown-video <input.md> --output <output.mp4> [options]   # render may be omitted
  markdown-video render - --output <output.mp4>               # read markdown from stdin
  markdown-video --markdown "# Hello" --output hello.mp4
  markdown-video doctor [--ffmpeg <path>] [--chromium <path>]
  markdown-video install-browser [--with-deps]
  markdown-video --version

Quick start:
  npm install -g markdown-video
  markdown-video install-browser
  markdown-video render video.md -o video.mp4

Render options:
  -o, --output <path>        output .mp4 path (or .gif with --format gif); required
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
      --deny-remote-network  block all non-loopback browser network requests
      --burn-captions        burn generated captions into the video frames
      --ffmpeg <path>        ffmpeg executable (default: FFMPEG_BIN or PATH)
      --chromium <path>      Chromium executable (default: Playwright browser)
  -v, --version              print version
  -h, --help                 print this help

Examples:
  markdown-video render video.md -o video.mp4
  markdown-video render video.md -o reel.mp4 --format reels --resolution 1080p
  markdown-video render video.md -o preview.gif --format gif --fps 12
  markdown-video render video.md -o video.mp4 --burn-captions --locale en
  cat video.md | markdown-video render - -o video.mp4 --deny-remote-network

Dependencies:
  ffmpeg with libx264/AAC support must be installed separately. Chromium is
  installed into the Playwright user cache by \`markdown-video install-browser\`.
  Run \`markdown-video doctor\` for a complete dependency check and fix-it advice.
`

const DOCTOR_HELP = `markdown-video doctor — check renderer dependencies

Usage:
  markdown-video doctor [--ffmpeg <path>] [--chromium <path>]

Checks:
  • Node.js version (20 or newer)
  • embedded render-page assets and SHA-256-verified bundled fonts
  • ffmpeg availability plus libx264/AAC/video/audio filter capabilities
  • Chromium launchability (Playwright-managed browser or --chromium override)

Options:
      --ffmpeg <path>    ffmpeg executable to check (default: FFMPEG_BIN or PATH)
      --chromium <path>  Chromium executable to check instead of Playwright's browser
  -h, --help             print this help

Exit status is 0 when every check passes and 1 when anything needs attention.
`

const INSTALL_BROWSER_HELP = `markdown-video install-browser — install Playwright Chromium

Usage:
  markdown-video install-browser [--with-deps]

Options:
      --with-deps  on Linux, also install required system libraries (may use sudo)
  -h, --help       print this help

The browser is installed into Playwright's user cache and shared with other
Playwright applications of the same browser revision. Set PLAYWRIGHT_BROWSERS_PATH
before running this command (and before rendering) to choose another cache location.
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
  if (argv[0] === "doctor") {
    const doctorArgs = parseDoctorCliArgs(argv.slice(1))
    if (doctorArgs.help) {
      process.stdout.write(DOCTOR_HELP)
      return 0
    }
    const report = await runDoctorChecks({
      ffmpegPath: doctorArgs.ffmpegPath,
      chromiumExecutablePath: doctorArgs.chromiumExecutablePath,
    })
    process.stdout.write(formatDoctorReport(report))
    return report.ok ? 0 : 1
  }

  if (argv[0] === "install-browser") {
    const installArgs = parseInstallBrowserCliArgs(argv.slice(1))
    if (installArgs.help) {
      process.stdout.write(INSTALL_BROWSER_HELP)
      return 0
    }
    await installPlaywrightChromium({ withDeps: installArgs.withDeps })
    process.stdout.write("Playwright Chromium is installed. Run `markdown-video doctor` to verify the complete setup.\n")
    return 0
  }

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
  let markdownBaseDir = cwd
  if (args.markdown !== null) {
    markdown = args.markdown
  } else if (args.inputPath === "-") {
    markdown = await readStdin()
  } else {
    const inputPath = resolveInputPath(args.inputPath!, cwd)
    if (path.resolve(cwd, args.outputPath) === inputPath) {
      throw new UsageError("Input and output paths must be different files.")
    }
    markdownBaseDir = path.dirname(inputPath)
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
      allowRemoteNetwork: !args.denyRemoteNetwork,
      markdownBaseDir,
      burnCaptions: args.burnCaptions,
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

