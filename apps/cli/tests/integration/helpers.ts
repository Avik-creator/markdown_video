import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import path from "node:path"

export interface ProcessResult {
  code: number | null
  stdout: string
  stderr: string
}

export function runProcess(
  executable: string,
  args: string[],
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8")
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8")
    })
    child.once("error", reject)
    child.once("close", (code) => resolve({ code, stdout, stderr }))
  })
}

export async function ffprobeJson(outputPath: string) {
  const result = await runProcess("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames,pix_fmt,color_range:format=duration",
    "-of",
    "json",
    outputPath,
  ])
  if (result.code !== 0) {
    throw new Error(`ffprobe failed: ${result.stderr}`)
  }
  return JSON.parse(result.stdout) as {
    streams: Array<Record<string, string | number>>
    format: { duration: string }
  }
}

export async function extractFrame(
  videoPath: string,
  frameNumber: number,
  outputPath: string,
) {
  mkdirSync(path.dirname(outputPath), { recursive: true })
  const result = await runProcess("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    videoPath,
    "-vf",
    `select=eq(n\\,${frameNumber})`,
    "-frames:v",
    "1",
    outputPath,
  ])
  if (result.code !== 0) {
    throw new Error(`ffmpeg frame extraction failed: ${result.stderr}`)
  }
}
