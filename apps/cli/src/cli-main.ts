import { createRequire } from "node:module"
import { readFile } from "node:fs/promises"
import path from "node:path"

import {
  parseCliArgs,
  parseDiffCliArgs,
  parseDoctorCliArgs,
  parseInstallBrowserCliArgs,
  parsePreviewCliArgs,
} from "./args.js"
import { installPlaywrightChromium } from "./browser.js"
import { diffDocuments } from "./diff.js"
import { formatDiffReport } from "./diff-format.js"
import { formatDoctorReport, runDoctorChecks } from "./doctor.js"
import { UsageError } from "./errors.js"
import { resolveInputPath } from "./paths.js"
import { writePreviewFrames } from "./preview-output.js"
import { renderFrames, renderVideo, type RenderProgress } from "./render.js"

const require = createRequire(import.meta.url)

function loadPackageJson() {
  // Source and npm layouts keep package.json one directory above cli-main/cli.js.
  // Sandbox/job bundles place the executable and package.json in one flat
  // directory instead, so accept that layout as a deliberate transport fallback.
  for (const candidate of ["../package.json", "./package.json"]) {
    try {
      return require(candidate) as { version: string }
    } catch {
      // Try the next supported layout.
    }
  }
  throw new Error("Could not locate the markdown-video package.json.")
}

const packageJson = loadPackageJson()

const HELP = `markdown-video — render markdown scenes to MP4 or GIF

Usage:
  markdown-video render <input.md> --output <output.mp4> [options]
  markdown-video <input.md> --output <output.mp4> [options]   # render may be omitted
  markdown-video render - --output <output.mp4>               # read markdown from stdin
  markdown-video --markdown "# Hello" --output hello.mp4
  markdown-video preview <input.md> --times 0,1.5,3 --json
  markdown-video diff <old.md> <new.md> [--json] [--out-dir frames]
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

const PREVIEW_HELP = `markdown-video preview — capture exact-timeline PNG frames

Usage:
  markdown-video preview <input.md> --times 0,1.5,3 --json
  markdown-video preview <input.md> --output-dir frames
  markdown-video preview - --times 0,1 --json                  # read markdown from stdin
  markdown-video preview --markdown "# Hello" --json

Input:
  Input can be one markdown file, '-' for stdin, or --markdown text. When
  --times is omitted, five times are spread inclusively across the video duration.

Output modes (choose one):
      --json                 print one JSON object to stdout:
                             {duration,width,height,frames:[{time,pngBase64}]}
      --output-dir <dir>     write numbered lossless PNG files to a directory

Preview options:
      --times <list>         comma-separated timeline seconds, at most 16 frames
      --resolution <preset>  480p, 720p, 1080p (default), 1440p, or 4k
      --aspect-ratio <ratio> project aspect ratio: 16:9 (default), 9:16, 1:1, 4:3
      --locale <code>        localization override used by the scene renderer
      --overwrite            replace existing PNG files with --output-dir
      --allow-outside-cwd    permit the output directory outside the working directory
      --deny-remote-network  block all non-loopback browser network requests
      --chromium <path>      Chromium executable (default: Playwright browser)
  -h, --help                 print this help

Preview frames are direct lossless PNG screenshots at exact timeline times, not
lossy frames extracted from a rendered video. JSON output writes no extra stdout
text; diagnostics are written to stderr.
`

const DIFF_HELP = `markdown-video diff — compare rendered frames scene by scene

Usage:
  markdown-video diff <old.md> <new.md> [options]

What it does:
  Parses both documents, aligns scenes by content (including insertions,
  deletions, and reorders), captures only representative exact-time PNG frames,
  and compares those frame pairs perceptually. No mp4 or ffmpeg encode is used.

Output:
  Human output is the default. Use --json for exactly one machine-readable
  JSON object on stdout. Use --out-dir to write old | new | diff-highlight
  composite PNGs for each compared sample.

Options:
      --json                   print the machine-readable diff report
      --out-dir <dir>          write side-by-side comparison PNG files
      --threshold <percent>    unchanged-content failure threshold (default 0.1)
      --outlier-threshold <percent>
                               high-similarity modified-scene outlier threshold (default 25)
      --samples-per-scene <n>  1, 2 (default), or 3 interior frames per aligned scene
      --resolution <preset>    480p, 720p, 1080p (default), 1440p, or 4k
      --aspect-ratio <ratio>   project aspect ratio: 16:9 (default), 9:16, 1:1, 4:3
      --locale <code>          localization override used by the scene renderer
      --overwrite              replace existing comparison PNG files
      --allow-outside-cwd      permit the output directory outside the working directory
      --deny-remote-network    block all non-loopback browser network requests
      --chromium <path>        Chromium executable (default: Playwright browser)
  -h, --help                   print this help

Exit status:
  0  no unexpected visual changes
  3  unexpected visual changes were found
  2  usage/input error
  1  renderer or dependency failure
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

async function readMarkdownInput({
  inputPath,
  inlineMarkdown,
  cwd,
}: {
  inputPath: string | null
  inlineMarkdown: string | null
  cwd: string
}) {
  if (inlineMarkdown !== null) {
    return { markdown: inlineMarkdown, markdownBaseDir: cwd, resolvedInputPath: null }
  }
  if (inputPath === "-") {
    return { markdown: await readStdin(), markdownBaseDir: cwd, resolvedInputPath: null }
  }
  const resolvedInputPath = resolveInputPath(inputPath!, cwd)
  return {
    markdown: await readFile(resolvedInputPath, "utf8"),
    markdownBaseDir: path.dirname(resolvedInputPath),
    resolvedInputPath,
  }
}

function installCancellationHandlers(action = "render") {
  const abort = new AbortController()
  const cancel = (signal: NodeJS.Signals) => {
    if (!abort.signal.aborted) {
      process.stderr.write(`\nReceived ${signal}; cancelling ${action}...\n`)
      abort.abort()
    }
  }
  const onSigint = () => cancel("SIGINT")
  const onSigterm = () => cancel("SIGTERM")
  process.once("SIGINT", onSigint)
  process.once("SIGTERM", onSigterm)

  return {
    signal: abort.signal,
    cleanup() {
      process.off("SIGINT", onSigint)
      process.off("SIGTERM", onSigterm)
    },
  }
}

async function runPreviewCommand(argv: string[]) {
  const args = parsePreviewCliArgs(argv)
  if (args.help) {
    process.stdout.write(PREVIEW_HELP)
    return 0
  }

  if (!args.inputPath && args.markdown === null) {
    throw new UsageError("Missing markdown input file, stdin '-', or --markdown.")
  }
  if (args.json && args.outputDir) {
    throw new UsageError("Use either --json or --output-dir, not both.")
  }
  if (!args.json && !args.outputDir) {
    throw new UsageError("Choose a preview output mode: --json or --output-dir <dir>.")
  }

  const cwd = process.cwd()
  const { markdown } = await readMarkdownInput({
    inputPath: args.inputPath,
    inlineMarkdown: args.markdown,
    cwd,
  })
  const cancellation = installCancellationHandlers()

  try {
    const result = await renderFrames({
      markdown,
      times: args.times,
      resolution: args.resolution,
      aspectRatio: args.aspectRatio,
      locale: args.locale ?? null,
      chromiumExecutablePath: args.chromiumExecutablePath,
      allowRemoteNetwork: !args.denyRemoteNetwork,
      signal: cancellation.signal,
    })

    if (args.json) {
      process.stdout.write(`${JSON.stringify({
        duration: result.totalDuration,
        width: result.width,
        height: result.height,
        frames: result.frames.map((frame) => ({
          time: frame.time,
          pngBase64: frame.png.toString("base64"),
        })),
      })}\n`)
      return 0
    }

    const writtenPaths = await writePreviewFrames({
      frames: result.frames,
      outputDir: args.outputDir!,
      cwd,
      overwrite: args.overwrite,
      allowOutsideCwd: args.allowOutsideCwd,
    })
    process.stderr.write(
      `Wrote ${writtenPaths.length} preview frame(s) for a ${result.totalDuration}s video (${result.width}x${result.height}):\n${writtenPaths.map((filePath) => `  ${filePath}\n`).join("")}`,
    )
    return 0
  } finally {
    cancellation.cleanup()
  }
}

async function runDiffCommand(argv: string[]) {
  const args = parseDiffCliArgs(argv)
  if (args.help) {
    process.stdout.write(DIFF_HELP)
    return 0
  }

  if (!args.oldInputPath || !args.newInputPath) {
    throw new UsageError("Missing diff input files. Expected <old.md> and <new.md>.")
  }

  const cwd = process.cwd()
  const resolvedOldInputPath = resolveInputPath(args.oldInputPath, cwd)
  const resolvedNewInputPath = resolveInputPath(args.newInputPath, cwd)
  const [oldMarkdown, newMarkdown] = await Promise.all([
    readFile(resolvedOldInputPath, "utf8"),
    readFile(resolvedNewInputPath, "utf8"),
  ])
  const cancellation = installCancellationHandlers("diff")

  try {
    const result = await diffDocuments({
      oldMarkdown,
      newMarkdown,
      oldPath: args.oldInputPath,
      newPath: args.newInputPath,
      cwd,
      resolution: args.resolution,
      aspectRatio: args.aspectRatio,
      locale: args.locale ?? null,
      chromiumExecutablePath: args.chromiumExecutablePath,
      allowRemoteNetwork: !args.denyRemoteNetwork,
      samplesPerScene: args.samplesPerScene,
      unchangedThresholdPercent: args.thresholdPercent,
      modifiedOutlierPercent: args.outlierThresholdPercent,
      outDir: args.outDir,
      overwrite: args.overwrite,
      allowOutsideCwd: args.allowOutsideCwd,
      signal: cancellation.signal,
    })

    if (args.json) {
      process.stdout.write(`${JSON.stringify(result.report)}\n`)
    } else {
      process.stdout.write(formatDiffReport(result.report))
    }
    return result.exitCode
  } finally {
    cancellation.cleanup()
  }
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

  if (argv[0] === "preview") {
    return runPreviewCommand(argv.slice(1))
  }

  if (argv[0] === "diff") {
    return runDiffCommand(argv.slice(1))
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
  const input = await readMarkdownInput({
    inputPath: args.inputPath,
    inlineMarkdown: args.markdown,
    cwd,
  })
  if (
    input.resolvedInputPath &&
    path.resolve(cwd, args.outputPath) === input.resolvedInputPath
  ) {
    throw new UsageError("Input and output paths must be different files.")
  }
  const { markdown, markdownBaseDir } = input
  const cancellation = installCancellationHandlers()

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
      signal: cancellation.signal,
      onProgress,
    })
    finishProgressLine()
    process.stderr.write(
      `Rendered ${result.width}x${result.height} ${result.format} (${result.totalFrames} frames at ${result.fps}fps) in ${result.elapsedSeconds.toFixed(1)}s -> ${result.outputPath}\n`,
    )
    return 0
  } finally {
    finishProgressLine()
    cancellation.cleanup()
  }
}

