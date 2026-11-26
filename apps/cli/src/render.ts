import { mkdir, unlink } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"

import { chromium, type Browser, type Page } from "playwright"
import {
  createRenderPlan,
  parseMarkdown,
  validateExportInput,
} from "@markdown-video/core"

import { RenderError, throwIfAborted, UsageError } from "./errors.js"
import { buildFfmpegArgs, startFfmpeg, type FFmpegProcess } from "./ffmpeg.js"
import { resolveOutputPath } from "./paths.js"
import { serveRenderPage, type RenderPageServer } from "./static-server.js"
import {
  resolveRenderSettings,
  type RenderSettings,
} from "./settings.js"

export const MAX_MARKDOWN_BYTES = 512 * 1024

export interface RenderProgress {
  phase: "preparing" | "capturing" | "encoding" | "complete"
  frame: number
  totalFrames: number
  percent: number
}

export interface RenderVideoOptions {
  markdown: string
  outputPath: string
  cwd?: string | undefined
  resolution?: string | undefined
  quality?: string | undefined
  speed?: string | undefined
  format?: string | undefined
  aspectRatio?: string | undefined
  locale?: string | null | undefined
  fps?: number | undefined
  overwrite?: boolean | undefined
  allowOutsideCwd?: boolean | undefined
  ffmpegPath?: string | undefined
  chromiumExecutablePath?: string | undefined
  signal?: AbortSignal | undefined
  onProgress?: ((progress: RenderProgress) => void) | undefined
}

export interface RenderVideoResult {
  outputPath: string
  format: string
  width: number
  height: number
  fps: number
  totalFrames: number
  totalDuration: number
  elapsedSeconds: number
}

function progress(
  options: RenderVideoOptions,
  update: RenderProgress,
) {
  options.onProgress?.(update)
}

function validateMarkdown(markdown: string) {
  if (!markdown.trim()) {
    throw new UsageError("Markdown input is empty.")
  }
  const bytes = Buffer.byteLength(markdown, "utf8")
  if (bytes > MAX_MARKDOWN_BYTES) {
    throw new UsageError(
      `Markdown input is ${bytes} bytes; the limit is ${MAX_MARKDOWN_BYTES} bytes.`,
    )
  }
}

function parseScenes(markdown: string) {
  try {
    return parseMarkdown(markdown)
  } catch (error) {
    throw new UsageError(
      `Could not parse markdown input: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

interface BrowserRenderHost {
  load(markdown: string): Promise<number>
  seek(t: number): Promise<void>
  totalDuration: number
}

declare global {
  interface Window {
    __mv?: BrowserRenderHost
  }
}

async function closeSilently(close: () => Promise<void>) {
  try {
    await close()
  } catch {
    // Cleanup is best-effort; the original render error is more useful.
  }
}

async function preparePage({
  page,
  url,
  settings,
  markdown,
}: {
  page: Page
  url: string
  settings: RenderSettings
  markdown: string
}) {
  const query = new URLSearchParams()
  query.set("aspect", settings.aspectRatio)
  if (settings.locale) query.set("locale", settings.locale)
  const pageUrl = `${url}/?${query.toString()}`

  page.setDefaultTimeout(30_000)
  await page.goto(pageUrl, { waitUntil: "load", timeout: 30_000 })
  await page.waitForFunction(
    () => window.__mv && typeof window.__mv.load === "function",
    undefined,
    { timeout: 30_000 },
  )
  return page.evaluate((source) => window.__mv!.load(source), markdown)
}

export async function renderVideo(
  options: RenderVideoOptions,
): Promise<RenderVideoResult> {
  const started = performance.now()
  validateMarkdown(options.markdown)
  const settings = resolveRenderSettings(options)
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const scenes = parseScenes(options.markdown)
  const totalDuration = scenes.reduce(
    (sum, scene) => sum + scene.duration,
    0,
  )
  const validation = validateExportInput({
    sceneCount: scenes.length,
    totalDuration,
    fps: settings.fps,
  })
  if (!validation.valid) {
    throw new UsageError(validation.reason ?? "Input cannot be exported.")
  }

  const fps = validation.outputFps
  const totalFrames = validation.totalFrameCount
  const plan = createRenderPlan({
    resolution: settings.resolution,
    projectAspectRatio: settings.aspectRatio,
    format: settings.format,
    quality: settings.quality,
  })
  const outputPath = resolveOutputPath({
    outputPath: options.outputPath,
    cwd,
    format: settings.format,
    overwrite: settings.overwrite,
    allowOutsideCwd: settings.allowOutsideCwd,
  })
  const outputExisted = existsSync(outputPath)
  await mkdir(path.dirname(outputPath), { recursive: true })

  const executable = options.ffmpegPath ?? process.env.FFMPEG_BIN ?? "ffmpeg"
  const ffmpegArgs = buildFfmpegArgs({
    plan,
    format: settings.format,
    quality: settings.quality,
    speed: settings.speed,
    fps,
    totalDuration,
    outputPath,
    overwrite: settings.overwrite,
  })

  let server: RenderPageServer | null = null
  let browser: Browser | null = null
  let ffmpeg: FFmpegProcess | null = null
  let encodingStarted = false

  progress(options, {
    phase: "preparing",
    frame: 0,
    totalFrames,
    percent: 0,
  })

  try {
    throwIfAborted(options.signal)
    server = await serveRenderPage()
    browser = await chromium.launch({
      headless: true,
      ...(options.chromiumExecutablePath
        ? { executablePath: options.chromiumExecutablePath }
        : {}),
      args: [
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-extensions",
        "--disable-sync",
        "--hide-scrollbars",
        "--mute-audio",
      ],
    })

    const context = await browser.newContext({
      viewport: {
        width: plan.layoutWidth,
        height: Math.ceil(plan.layoutHeight),
      },
      deviceScaleFactor: plan.captureScale,
      reducedMotion: "reduce",
      colorScheme: "dark",
    })
    const page = await context.newPage()
    const browserDuration = await preparePage({
      page,
      url: server.url,
      settings,
      markdown: options.markdown,
    })
    if (Math.abs(browserDuration - totalDuration) > 1e-6) {
      throw new RenderError(
        `Browser parse duration (${browserDuration}) did not match CLI parse duration (${totalDuration}).`,
      )
    }

    const captureTarget = page.locator('[data-scene-preview="true"]')
    await captureTarget.waitFor({ state: "visible", timeout: 30_000 })

    ffmpeg = startFfmpeg(executable, ffmpegArgs)
    encodingStarted = true

    const jpegQuality = Math.round(plan.frameQuality * 100)
    for (let frame = 0; frame < totalFrames; frame += 1) {
      throwIfAborted(options.signal)
      const time = Math.min(frame / fps, totalDuration)
      await page.evaluate((t) => window.__mv!.seek(t), time)
      const jpeg = await captureTarget.screenshot({
        type: "jpeg",
        quality: jpegQuality,
        scale: "device",
      })
      if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
        throw new RenderError(
          `Playwright returned invalid JPEG data for frame ${frame}.`,
        )
      }
      await ffmpeg.writeFrame(jpeg)
      const percent = ((frame + 1) / totalFrames) * 100
      progress(options, {
        phase: "capturing",
        frame: frame + 1,
        totalFrames,
        percent,
      })
    }

    progress(options, {
      phase: "encoding",
      frame: totalFrames,
      totalFrames,
      percent: 100,
    })
    await ffmpeg.finish()
    encodingStarted = false

    const elapsedSeconds = (performance.now() - started) / 1000
    progress(options, {
      phase: "complete",
      frame: totalFrames,
      totalFrames,
      percent: 100,
    })
    return {
      outputPath,
      format: settings.format,
      width: plan.width,
      height: plan.height,
      fps,
      totalFrames,
      totalDuration,
      elapsedSeconds,
    }
  } catch (error) {
    ffmpeg?.abort()
    if (!outputExisted) {
      await unlink(outputPath).catch(() => undefined)
    }
    throw error
  } finally {
    if (encodingStarted) ffmpeg?.abort()
    if (browser) await closeSilently(() => browser!.close())
    if (server) await closeSilently(() => server!.close())
  }
}
