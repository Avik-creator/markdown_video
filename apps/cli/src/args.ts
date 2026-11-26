import { parseArgs } from "node:util"

import { UsageError } from "./errors.js"

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
