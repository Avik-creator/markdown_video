import { once } from "node:events"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"

import {
  buildMusicAudioFilter,
  buildMusicInputArgs,
  buildMusicOutputArgs,
  getVideoEncodingSettings,
  type MusicTrack,
  type RenderPlan,
} from "@markdown-video/core"

import { RenderError } from "./errors.js"

const MAX_FFMPEG_STDERR_CHARS = 64 * 1024

export interface FFmpegCommandInput {
  plan: RenderPlan
  format: string
  quality: string
  speed: string
  fps: number
  totalDuration: number
  outputPath: string
  overwrite: boolean
  /** Prepared local/temporary input file for document music. Ignored for GIF. */
  music?: (Pick<MusicTrack, "volume" | "fade" | "loop"> & { inputPath: string }) | undefined
  /** Fixed captions filename in the ffmpeg process cwd when burn-in is enabled. */
  burnCaptionsFileName?: string | undefined
}

/**
 * Build native ffmpeg arguments as an array. No value is ever concatenated
 * into a shell command, so paths and filter expressions cannot be reparsed by
 * a shell. The mp4 branch intentionally matches the browser exporter's codec,
 * preset/CRF, pixel-format, and duration semantics while replacing its MEMFS
 * frame sequence with image2pipe.
 */
export function buildFfmpegArgs(input: FFmpegCommandInput): string[] {
  const { plan, fps, totalDuration, outputPath, overwrite } = input
  const overwriteFlag = overwrite ? "-y" : "-n"
  const base = [
    "-v",
    "error",
    overwriteFlag,
    "-f",
    "image2pipe",
    // Chromium screenshots are always JPEG in the video path. Naming the
    // decoder avoids relying on image2pipe probe behavior, which differs
    // across ffmpeg major versions when concatenated frames are streamed.
    "-c:v",
    "mjpeg",
    "-framerate",
    String(fps),
    "-i",
    "pipe:0",
    ...(input.music && input.format !== "gif" ? buildMusicInputArgs(input.music, input.music.inputPath) : []),
  ]

  if (input.burnCaptionsFileName !== undefined &&
      !/^[A-Za-z0-9_.-]+$/.test(input.burnCaptionsFileName)) {
    throw new RenderError("Internal error: captions filename is not safe for a filter argument.")
  }
  const subtitlesFilter = input.burnCaptionsFileName
    ? `,subtitles=${input.burnCaptionsFileName}`
    : ""

  if (input.format === "gif") {
    // Browsers commonly quantize animated GIFs heavily; a 64-color palette keeps
    // output small and closely parallels the browser exporter's quality=10.
    const gifFps = Math.min(fps, 10)
    const explicitFilter =
      `scale=${plan.width}:${plan.height}:flags=lanczos,` +
      `fps=${gifFps}` +
      `${subtitlesFilter},` +
      "split[x][y];[x]palettegen=max_colors=64[p];[y][p]paletteuse=dither=bayer:bayer_scale=2"
    return [
      ...base,
      "-filter_complex",
      explicitFilter,
      "-loop",
      "0",
      "-f",
      "gif",
      outputPath,
    ]
  }

  const encoding = getVideoEncodingSettings(input.quality, input.speed)
  // Chromium JPEG screenshots are full-range. Convert range explicitly rather
  // than merely naming yuv420p: otherwise current native ffmpeg preserves the
  // input's yuvj420p full-range pixel format, which is not the compatibility
  // target promised by the shared web-export arguments.
  const musicOutputArgs = input.music && input.format !== "gif"
    ? buildMusicOutputArgs(buildMusicAudioFilter(input.music, totalDuration))
    : []
  return [
    ...base,
    ...musicOutputArgs,
    "-vf",
    `scale=${plan.width}:${plan.height}:flags=lanczos:out_range=limited,setsar=1${subtitlesFilter}`,
    "-c:v",
    "libx264",
    "-preset",
    encoding.preset,
    "-crf",
    String(encoding.crf),
    "-pix_fmt",
    "yuv420p",
    "-t",
    totalDuration.toFixed(3),
    outputPath,
  ]
}

export interface FFmpegProcess {
  writeFrame(frame: Buffer): Promise<void>
  finish(): Promise<void>
  abort(): void
}

interface FFmpegCompletion {
  code: number | null
  signal: NodeJS.Signals | null
  spawnError: Error | null
}

function appendCapped(current: string, chunk: Buffer) {
  const next = current + chunk.toString("utf8")
  return next.length <= MAX_FFMPEG_STDERR_CHARS
    ? next
    : next.slice(next.length - MAX_FFMPEG_STDERR_CHARS)
}

function ffmpegFailure(prefix: string, stderr: string) {
  const tail = stderr.trim().split("\n").slice(-8).join("\n").trim()
  return new RenderError(tail ? `${prefix}\n${tail}` : prefix)
}

export function startFfmpeg(
  executable: string,
  args: string[],
  options: { cwd?: string | undefined } = {},
): FFmpegProcess {
  const child: ChildProcessWithoutNullStreams = spawn(executable, args, {
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    ...(options.cwd ? { cwd: options.cwd } : {}),
  })

  let stderr = ""
  let spawnError: Error | null = null
  let writeError: Error | null = null
  let completed = false

  child.stderr.on("data", (chunk: Buffer) => {
    stderr = appendCapped(stderr, chunk)
  })
  child.once("error", (error) => {
    spawnError = error
  })
  child.stdin.once("error", (error) => {
    writeError = error
  })

  const completion = new Promise<FFmpegCompletion>((resolve) => {
    child.once("close", (code, signal) => {
      completed = true
      resolve({ code, signal, spawnError })
    })
  })

  function throwWriteFailure(): never {
    if (writeError) {
      throw ffmpegFailure("Failed to write a frame to ffmpeg.", stderr)
    }
    if (spawnError) {
      throw new RenderError(
        `Failed to start ffmpeg executable "${executable}": ${spawnError.message}`,
        { cause: spawnError },
      )
    }
    if (completed) {
      throw ffmpegFailure("ffmpeg exited before all frames were written.", stderr)
    }
    throw new RenderError("ffmpeg is not accepting frames.")
  }

  return {
    async writeFrame(frame: Buffer) {
      if (writeError || spawnError || completed) throwWriteFailure()
      if (!child.stdin.writable) throwWriteFailure()
      try {
        if (!child.stdin.write(frame)) {
          await once(child.stdin, "drain")
        }
      } catch {
        throwWriteFailure()
      }
      if (writeError || spawnError || completed) throwWriteFailure()
    },

    async finish() {
      if (!child.stdin.destroyed && child.stdin.writable) {
        child.stdin.end()
      }
      const result = await completion
      if (result.spawnError) {
        throw new RenderError(
          `Failed to start ffmpeg executable "${executable}": ${result.spawnError.message}`,
          { cause: result.spawnError },
        )
      }
      if (result.code !== 0) {
        const reason =
          result.signal != null
            ? `ffmpeg terminated with signal ${result.signal}.`
            : `ffmpeg exited with code ${String(result.code)}.`
        throw ffmpegFailure(reason, stderr)
      }
    },

    abort() {
      if (!child.killed && !completed) {
        child.kill("SIGKILL")
      }
      if (!child.stdin.destroyed) {
        child.stdin.destroy()
      }
    },
  }
}
