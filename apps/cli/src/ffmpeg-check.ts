import { spawn } from "node:child_process"

import { RenderError } from "./errors.js"

const COMMAND_TIMEOUT_MS = 5_000

export interface FFmpegCapability {
  id: string
  label: string
  source: "encoders" | "filters"
  pattern: RegExp
}

export const REQUIRED_FFMPEG_CAPABILITIES: readonly FFmpegCapability[] = [
  {
    id: "libx264",
    label: "libx264 H.264 encoder",
    source: "encoders",
    pattern: /\blibx264\b/,
  },
  {
    id: "aac",
    label: "AAC audio encoder",
    source: "encoders",
    pattern: /\baac\b/,
  },
  {
    id: "scale",
    label: "scale video filter",
    source: "filters",
    pattern: /\bscale\b/,
  },
  {
    id: "setsar",
    label: "setsar video filter",
    source: "filters",
    pattern: /\bsetsar\b/,
  },
  {
    id: "fps",
    label: "fps video filter",
    source: "filters",
    pattern: /\bfps\b/,
  },
  {
    id: "split",
    label: "split video filter",
    source: "filters",
    pattern: /\bsplit\b/,
  },
  {
    id: "palettegen",
    label: "palettegen GIF filter",
    source: "filters",
    pattern: /\bpalettegen\b/,
  },
  {
    id: "paletteuse",
    label: "paletteuse GIF filter",
    source: "filters",
    pattern: /\bpaletteuse\b/,
  },
  {
    id: "volume",
    label: "volume audio filter",
    source: "filters",
    pattern: /\bvolume\b/,
  },
  {
    id: "atrim",
    label: "atrim audio filter",
    source: "filters",
    pattern: /\batrim\b/,
  },
  {
    id: "asetpts",
    label: "asetpts audio filter",
    source: "filters",
    pattern: /\basetpts\b/,
  },
  {
    id: "afade",
    label: "afade audio filter",
    source: "filters",
    pattern: /\bafade\b/,
  },
]

export interface FFmpegCheck {
  executable: string
  ok: boolean
  version?: string | undefined
  detail: string
  missingCapabilities: string[]
  error?: string | undefined
}

interface CommandResult {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  error?: Error | undefined
  timedOut: boolean
}

function runCommand(executable: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(executable, args, {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      })
    } catch (error) {
      resolve({
        code: null,
        signal: null,
        stdout: "",
        stderr: "",
        error: error instanceof Error ? error : new Error(String(error)),
        timedOut: false,
      })
      return
    }

    let stdout = ""
    let stderr = ""
    let error: Error | undefined
    let timedOut = false
    let settled = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, COMMAND_TIMEOUT_MS)

    function finish(result: Omit<CommandResult, "stdout" | "stderr" | "timedOut" | "error"> & { error?: Error | undefined }) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        ...result,
        stdout,
        stderr,
        timedOut,
      })
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8")
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8")
    })
    child.once("error", (spawnError) => {
      error = spawnError
    })
    child.once("close", (code, signal) => {
      finish({ code, signal, ...(error ? { error } : {}) })
    })
  })
}

export function parseFfmpegVersion(output: string) {
  const firstLine = output.split("\n", 1)[0]?.trim()
  const match = firstLine?.match(/^ffmpeg version\s+(\S+)/)
  return match?.[1]
}

export function missingFfmpegCapabilities({
  encoders,
  filters,
}: {
  encoders: string
  filters: string
}) {
  return REQUIRED_FFMPEG_CAPABILITIES.filter((capability) => {
    const source = capability.source === "encoders" ? encoders : filters
    return !capability.pattern.test(source)
  }).map((capability) => capability.label)
}

function commandFailure(result: CommandResult) {
  if (result.timedOut) return `timed out after ${COMMAND_TIMEOUT_MS}ms`
  if (result.error) return result.error.message
  if (result.signal) return `terminated with signal ${result.signal}`
  if (result.code !== 0) {
    const tail = result.stderr.trim().split("\n").slice(-3).join("\n")
    return `exited with code ${String(result.code)}${tail ? `: ${tail}` : ""}`
  }
  return null
}

export async function checkFfmpeg(executable: string): Promise<FFmpegCheck> {
  const versionResult = await runCommand(executable, ["-hide_banner", "-version"])
  const versionFailure = commandFailure(versionResult)
  if (versionFailure) {
    return {
      executable,
      ok: false,
      detail: `could not run ffmpeg: ${versionFailure}`,
      missingCapabilities: [],
      error: versionFailure,
    }
  }

  const version = parseFfmpegVersion(versionResult.stdout)
  const [encodersResult, filtersResult] = await Promise.all([
    runCommand(executable, ["-hide_banner", "-encoders"]),
    runCommand(executable, ["-hide_banner", "-filters"]),
  ])
  const capabilityCommandFailure =
    commandFailure(encodersResult) ?? commandFailure(filtersResult)
  if (capabilityCommandFailure) {
    return {
      executable,
      ok: false,
      ...(version ? { version } : {}),
      detail: `could not inspect ffmpeg capabilities: ${capabilityCommandFailure}`,
      missingCapabilities: [],
      error: capabilityCommandFailure,
    }
  }

  const missingCapabilities = missingFfmpegCapabilities({
    encoders: encodersResult.stdout,
    filters: filtersResult.stdout,
  })
  if (missingCapabilities.length > 0) {
    return {
      executable,
      ok: false,
      ...(version ? { version } : {}),
      detail: `missing required capabilities: ${missingCapabilities.join(", ")}`,
      missingCapabilities,
    }
  }

  return {
    executable,
    ok: true,
    ...(version ? { version } : {}),
    detail: version ? `ffmpeg ${version}` : "ffmpeg is available",
    missingCapabilities: [],
  }
}

export function ffmpegInstallInstructions() {
  return [
    "Install a full ffmpeg build with libx264 and AAC support, then run `markdown-video doctor`:",
    "  macOS:         brew install ffmpeg",
    "  Ubuntu/Debian: sudo apt-get update && sudo apt-get install -y ffmpeg",
    "  Windows:       winget install Gyan.FFmpeg",
    "Alternatively pass `--ffmpeg /path/to/ffmpeg` or set FFMPEG_BIN.",
  ].join("\n")
}

export function ffmpegNotReadyMessage(check: FFmpegCheck) {
  return [
    `ffmpeg is not ready (${check.detail}).`,
    "",
    ffmpegInstallInstructions(),
    "The markdown-video package intentionally does not download a bundled GPL ffmpeg binary;",
    "using a system/package-manager ffmpeg keeps licensing and security updates explicit.",
  ].join("\n")
}

export async function assertFfmpegReady(executable: string) {
  const check = await checkFfmpeg(executable)
  if (!check.ok) {
    throw new RenderError(ffmpegNotReadyMessage(check))
  }
  return check
}
