import { parseArgs } from "node:util"

import { UsageError } from "./errors.js"

export interface DoctorCliArgs {
  ffmpegPath?: string | undefined
  chromiumExecutablePath?: string | undefined
  help: boolean
}

export interface InstallBrowserCliArgs {
  withDeps: boolean
  help: boolean
}

export interface CliArgs {
  command: "render"
  inputPath: string | null
  markdown: string | null
  outputPath: string | null
  resolution?: string | undefined
  quality?: string | undefined
  speed?: string | undefined
  format?: string | undefined
  aspectRatio?: string | undefined
  locale?: string | undefined
  fps?: number | undefined
  overwrite: boolean
  allowOutsideCwd: boolean
  denyRemoteNetwork: boolean
  burnCaptions: boolean
  ffmpegPath?: string | undefined
  chromiumExecutablePath?: string | undefined
  help: boolean
  version: boolean
}

export interface PreviewCliArgs {
  inputPath: string | null
  markdown: string | null
  times?: number[] | undefined
  resolution?: string | undefined
  aspectRatio?: string | undefined
  locale?: string | undefined
  json: boolean
  outputDir: string | null
  overwrite: boolean
  allowOutsideCwd: boolean
  denyRemoteNetwork: boolean
  chromiumExecutablePath?: string | undefined
  help: boolean
}

export interface DiffCliArgs {
  oldInputPath: string | null
  newInputPath: string | null
  json: boolean
  outDir: string | null
  thresholdPercent?: number | undefined
  outlierThresholdPercent?: number | undefined
  samplesPerScene?: number | undefined
  resolution?: string | undefined
  aspectRatio?: string | undefined
  locale?: string | undefined
  overwrite: boolean
  allowOutsideCwd: boolean
  denyRemoteNetwork: boolean
  chromiumExecutablePath?: string | undefined
  help: boolean
}

function stringValue(value: string | boolean | undefined) {
  return typeof value === "string" ? value : undefined
}

export function parseCliArgs(argv: string[]): CliArgs {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        markdown: { type: "string", short: "m" },
        output: { type: "string", short: "o" },
        resolution: { type: "string" },
        quality: { type: "string" },
        speed: { type: "string" },
        format: { type: "string" },
        "aspect-ratio": { type: "string" },
        locale: { type: "string" },
        fps: { type: "string" },
        overwrite: { type: "boolean" },
        "allow-outside-cwd": { type: "boolean" },
        "deny-remote-network": { type: "boolean" },
        "burn-captions": { type: "boolean" },
        ffmpeg: { type: "string" },
        chromium: { type: "string" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    })
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }

  const positionals = [...parsed.positionals]
  if (positionals[0] === "render") {
    positionals.shift()
  }

  if (positionals.length > 1) {
    throw new UsageError(`Unexpected positional argument: ${positionals[1]}`)
  }

  const inputPath = positionals[0] ?? null
  const markdown = stringValue(parsed.values.markdown) ?? null
  if (inputPath && markdown !== null) {
    throw new UsageError("Use either an input file or --markdown, not both.")
  }

  const fpsText = stringValue(parsed.values.fps)
  let fps: number | undefined
  if (fpsText !== undefined) {
    fps = Number(fpsText)
    if (!Number.isFinite(fps)) {
      throw new UsageError(`Invalid --fps value "${fpsText}".`)
    }
  }

  return {
    command: "render",
    inputPath,
    markdown,
    outputPath: stringValue(parsed.values.output) ?? null,
    resolution: stringValue(parsed.values.resolution),
    quality: stringValue(parsed.values.quality),
    speed: stringValue(parsed.values.speed),
    format: stringValue(parsed.values.format),
    aspectRatio: stringValue(parsed.values["aspect-ratio"]),
    locale: stringValue(parsed.values.locale),
    fps,
    overwrite: parsed.values.overwrite === true,
    allowOutsideCwd: parsed.values["allow-outside-cwd"] === true,
    denyRemoteNetwork: parsed.values["deny-remote-network"] === true,
    burnCaptions: parsed.values["burn-captions"] === true,
    ffmpegPath: stringValue(parsed.values.ffmpeg),
    chromiumExecutablePath: stringValue(parsed.values.chromium),
    help: parsed.values.help === true,
    version: parsed.values.version === true,
  }
}

function parsePreviewTimes(value: string | undefined) {
  if (value === undefined) return undefined
  const parts = value.split(",").map((part) => part.trim())
  if (parts.length === 0 || parts.some((part) => part.length === 0)) {
    throw new UsageError(
      "Invalid --times value. Expected a comma-separated list such as 0,1.5,3.",
    )
  }

  const times = parts.map((part) => Number(part))
  if (times.some((time) => !Number.isFinite(time) || time < 0)) {
    throw new UsageError("Preview --times values must be finite non-negative seconds.")
  }
  return times
}

export function parsePreviewCliArgs(argv: string[]): PreviewCliArgs {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        markdown: { type: "string", short: "m" },
        times: { type: "string" },
        resolution: { type: "string" },
        "aspect-ratio": { type: "string" },
        locale: { type: "string" },
        json: { type: "boolean" },
        "output-dir": { type: "string" },
        overwrite: { type: "boolean" },
        "allow-outside-cwd": { type: "boolean" },
        "deny-remote-network": { type: "boolean" },
        chromium: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    })
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }

  if (parsed.positionals.length > 1) {
    throw new UsageError(`Unexpected positional argument: ${parsed.positionals[1]}`)
  }

  const inputPath = parsed.positionals[0] ?? null
  const markdown = stringValue(parsed.values.markdown) ?? null
  if (inputPath && markdown !== null) {
    throw new UsageError("Use either an input file or --markdown, not both.")
  }

  return {
    inputPath,
    markdown,
    times: parsePreviewTimes(stringValue(parsed.values.times)),
    resolution: stringValue(parsed.values.resolution),
    aspectRatio: stringValue(parsed.values["aspect-ratio"]),
    locale: stringValue(parsed.values.locale),
    json: parsed.values.json === true,
    outputDir: stringValue(parsed.values["output-dir"]) ?? null,
    overwrite: parsed.values.overwrite === true,
    allowOutsideCwd: parsed.values["allow-outside-cwd"] === true,
    denyRemoteNetwork: parsed.values["deny-remote-network"] === true,
    chromiumExecutablePath: stringValue(parsed.values.chromium),
    help: parsed.values.help === true,
  }
}

function parsePercentOption(value: string | undefined, optionName: string) {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new UsageError(
      `Invalid ${optionName} value "${value}". Expected a number from 0 through 100.`,
    )
  }
  return parsed
}

function parseSamplesPerScene(value: string | undefined) {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) {
    throw new UsageError(
      `Invalid --samples-per-scene value "${value}". Expected an integer from 1 through 3.`,
    )
  }
  return parsed
}

export function parseDiffCliArgs(argv: string[]): DiffCliArgs {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        json: { type: "boolean" },
        "out-dir": { type: "string" },
        threshold: { type: "string" },
        "outlier-threshold": { type: "string" },
        "samples-per-scene": { type: "string" },
        resolution: { type: "string" },
        "aspect-ratio": { type: "string" },
        locale: { type: "string" },
        overwrite: { type: "boolean" },
        "allow-outside-cwd": { type: "boolean" },
        "deny-remote-network": { type: "boolean" },
        chromium: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    })
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }

  if (parsed.positionals.length > 2) {
    throw new UsageError(`Unexpected positional argument: ${parsed.positionals[2]}`)
  }

  return {
    oldInputPath: parsed.positionals[0] ?? null,
    newInputPath: parsed.positionals[1] ?? null,
    json: parsed.values.json === true,
    outDir: stringValue(parsed.values["out-dir"]) ?? null,
    thresholdPercent: parsePercentOption(
      stringValue(parsed.values.threshold),
      "--threshold",
    ),
    outlierThresholdPercent: parsePercentOption(
      stringValue(parsed.values["outlier-threshold"]),
      "--outlier-threshold",
    ),
    samplesPerScene: parseSamplesPerScene(
      stringValue(parsed.values["samples-per-scene"]),
    ),
    resolution: stringValue(parsed.values.resolution),
    aspectRatio: stringValue(parsed.values["aspect-ratio"]),
    locale: stringValue(parsed.values.locale),
    overwrite: parsed.values.overwrite === true,
    allowOutsideCwd: parsed.values["allow-outside-cwd"] === true,
    denyRemoteNetwork: parsed.values["deny-remote-network"] === true,
    chromiumExecutablePath: stringValue(parsed.values.chromium),
    help: parsed.values.help === true,
  }
}

export function parseDoctorCliArgs(argv: string[]): DoctorCliArgs {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        ffmpeg: { type: "string" },
        chromium: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    })
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }

  if (parsed.positionals.length > 0) {
    throw new UsageError(`Unexpected positional argument for doctor: ${parsed.positionals[0]}`)
  }

  return {
    ffmpegPath: stringValue(parsed.values.ffmpeg),
    chromiumExecutablePath: stringValue(parsed.values.chromium),
    help: parsed.values.help === true,
  }
}

export function parseInstallBrowserCliArgs(argv: string[]): InstallBrowserCliArgs {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        "with-deps": { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    })
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }

  if (parsed.positionals.length > 0) {
    throw new UsageError(`Unexpected positional argument for install-browser: ${parsed.positionals[0]}`)
  }

  return {
    withDeps: parsed.values["with-deps"] === true,
    help: parsed.values.help === true,
  }
}
