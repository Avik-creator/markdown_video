import { mkdir, mkdtemp, readFile, rm, stat, unlink, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { performance } from "node:perf_hooks"

import { chromium, type Browser, type Locator, type Page } from "playwright"
import {
  captionSidecarPathsForOutput,
  createRenderPlan,
  generateCaptionSidecars,
  parseMarkdownFull,
  validateExportInput,
  type RenderPlan,
} from "@markdown-video/core"

import { RenderError, throwIfAborted, UsageError } from "./errors.js"
import { assertFfmpegReady } from "./ffmpeg-check.js"
import { buildFfmpegArgs, startFfmpeg, type FFmpegProcess } from "./ffmpeg.js"
import { prepareMusicInput } from "./music.js"
import { resolveOutputPath } from "./paths.js"
import { serveRenderPage, type RenderPageServer } from "./static-server.js"
import {
  resolveRenderSettings,
  type RenderSettings,
} from "./settings.js"

export const MAX_MARKDOWN_BYTES = 512 * 1024
export const MAX_PREVIEW_FRAME_COUNT = 16

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
  /**
   * Preserve the CLI's document-rendering semantics by default: image scenes
   * may reference remote URLs. Service embedding the renderer should pass
   * false so Chromium can only reach the loopback static asset origin.
   */
  allowRemoteNetwork?: boolean | undefined
  /** Base directory for relative !music file paths. Defaults to cwd. */
  markdownBaseDir?: string | undefined
  /**
   * Composite generated captions into video frames as DOM during capture.
   * Burn-in needs no ffmpeg subtitles filter or libass build: captions are
   * rendered by the browser inside the captured scene, so encoding receives
   * frames that already contain them.
   */
  burnCaptions?: boolean | undefined
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
  captionCount?: number | undefined
  captionPaths?: { srtPath: string; vttPath: string } | undefined
  hasAudio?: boolean | undefined
  captionsBurnedIn?: boolean | undefined
}

export type RenderVideoBufferOptions = Omit<
  RenderVideoOptions,
  "outputPath" | "cwd" | "format" | "overwrite" | "allowOutsideCwd"
> & {
  /** Reject before reading the output into memory when it exceeds this size. */
  maxOutputBytes?: number | undefined
}

export interface RenderVideoBufferResult {
  mp4: Buffer
  format: "mp4"
  width: number
  height: number
  fps: number
  totalFrames: number
  totalDuration: number
  elapsedSeconds: number
  sizeBytes: number
}

export interface RenderFramesOptions {
  markdown: string
  times: number[]
  resolution?: string | undefined
  aspectRatio?: string | undefined
  locale?: string | null | undefined
  chromiumExecutablePath?: string | undefined
  /** See RenderVideoOptions.allowRemoteNetwork. */
  allowRemoteNetwork?: boolean | undefined
  signal?: AbortSignal | undefined
}

export interface RenderedFrame {
  time: number
  png: Buffer
}

export interface RenderFramesResult {
  frames: RenderedFrame[]
  width: number
  height: number
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

function parseDocument(markdown: string) {
  try {
    return parseMarkdownFull(markdown)
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

interface CaptureSession {
  page: Page
  captureTarget: Locator
  close(): Promise<void>
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
  burnCaptions = false,
}: {
  page: Page
  url: string
  settings: RenderSettings
  markdown: string
  burnCaptions?: boolean | undefined
}) {
  const query = new URLSearchParams()
  query.set("aspect", settings.aspectRatio)
  if (settings.locale) query.set("locale", settings.locale)
  if (burnCaptions) query.set("burnCaptions", "1")
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

/**
 * Restrict page network access to the loopback render-page origin. Image
 * scenes can contain arbitrary http(s) URLs; in a hosted worker those URLs
 * would otherwise turn the renderer into an egress/SSRF primitive. Data and
 * blob URLs do not create network egress and remain available.
 */
async function installLoopbackOnlyNetworkPolicy({
  page,
  allowedOrigin,
}: {
  page: Page
  allowedOrigin: string
}) {
  await page.route("**/*", (route) => {
    const requestUrl = route.request().url()
    if (requestUrl.startsWith("data:") || requestUrl.startsWith("blob:")) {
      return route.continue()
    }

    try {
      if (new URL(requestUrl).origin === allowedOrigin) {
        return route.continue()
      }
    } catch {
      // Malformed browser-internal URLs fall through to the deny response.
    }

    return route.fulfill({
      status: 403,
      contentType: "text/plain; charset=utf-8",
      body: "Blocked by the markdown-video renderer network policy",
    })
  })
}

async function openCaptureSession({
  markdown,
  settings,
  plan,
  totalDuration,
  chromiumExecutablePath,
  allowRemoteNetwork = true,
  burnCaptions = false,
}: {
  markdown: string
  settings: RenderSettings
  plan: RenderPlan
  totalDuration: number
  chromiumExecutablePath?: string | undefined
  allowRemoteNetwork?: boolean | undefined
  burnCaptions?: boolean | undefined
}): Promise<CaptureSession> {
  let server: RenderPageServer | null = null
  let browser: Browser | null = null

  try {
    server = await serveRenderPage()
    browser = await chromium.launch({
      headless: true,
      ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
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
    if (!allowRemoteNetwork) {
      await installLoopbackOnlyNetworkPolicy({
        page,
        allowedOrigin: new URL(server.url).origin,
      })
    }

    const browserDuration = await preparePage({
      page,
      url: server.url,
      settings,
      markdown,
      burnCaptions,
    })
    if (Math.abs(browserDuration - totalDuration) > 1e-6) {
      throw new RenderError(
        `Browser parse duration (${browserDuration}) did not match CLI parse duration (${totalDuration}).`,
      )
    }

    const captureTarget = page.locator('[data-scene-preview="true"]')
    await captureTarget.waitFor({ state: "visible", timeout: 30_000 })

    return {
      page,
      captureTarget,
      async close() {
        if (browser) await closeSilently(() => browser!.close())
        if (server) await closeSilently(() => server!.close())
      },
    }
  } catch (error) {
    if (browser) await closeSilently(() => browser!.close())
    if (server) await closeSilently(() => server!.close())
    throw error
  }
}


function validateRenderInput({
  markdown,
  fps,
}: {
  markdown: string
  fps: number
}) {
  const parsed = parseDocument(markdown)
  const scenes = parsed.scenes
  const totalDuration = scenes.reduce(
    (sum, scene) => sum + scene.duration,
    0,
  )
  const validation = validateExportInput({
    sceneCount: scenes.length,
    totalDuration,
    fps,
  })
  if (!validation.valid) {
    throw new UsageError(validation.reason ?? "Input cannot be exported.")
  }

  return { parsed, scenes, totalDuration, validation }
}

export async function renderVideo(
  options: RenderVideoOptions,
): Promise<RenderVideoResult> {
  const started = performance.now()
  validateMarkdown(options.markdown)
  const settings = resolveRenderSettings(options)
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const { parsed, totalDuration, validation } = validateRenderInput({
    markdown: options.markdown,
    fps: settings.fps,
  })

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

  const captionSidecars = generateCaptionSidecars(parsed, {
    activeLocale: settings.locale ?? null,
  })
  const hasCaptions = captionSidecars.cues.length > 0
  const sidecarPaths = captionSidecarPathsForOutput(outputPath)
  if (hasCaptions && !settings.overwrite) {
    for (const captionPath of [sidecarPaths.srtPath, sidecarPaths.vttPath]) {
      if (existsSync(captionPath)) {
        throw new UsageError(
          `Caption sidecar already exists: ${captionPath} (use --overwrite to replace it).`,
        )
      }
    }
  }

  // Burn-in is a capture-time DOM composition flag threaded to the render
  // page, not an encode-time ffmpeg concern: frames reaching ffmpeg already
  // contain the captions, so no subtitles filter, libass build, or font
  // provisioning is involved on the encoding path.
  const shouldBurnCaptions = options.burnCaptions === true && hasCaptions
  const music = settings.format === "gif" ? undefined : parsed.music
  const mediaTempDir = music !== undefined
    ? await mkdtemp(path.join(tmpdir(), "markdown-video-media-"))
    : null

  const executable = options.ffmpegPath ?? process.env.FFMPEG_BIN ?? "ffmpeg"
  let preparedMusic
  let ffmpegArgs: string[]
  try {
    preparedMusic = music && mediaTempDir
      ? await prepareMusicInput({
          music,
          markdownBaseDir: path.resolve(options.markdownBaseDir ?? cwd),
          tempDir: mediaTempDir,
          allowExternalMusic: options.allowRemoteNetwork ?? true,
        })
      : undefined

    ffmpegArgs = buildFfmpegArgs({
      plan,
      format: settings.format,
      quality: settings.quality,
      speed: settings.speed,
      fps,
      totalDuration,
      outputPath,
      overwrite: settings.overwrite,
      ...(preparedMusic ? { music: { ...music!, inputPath: preparedMusic.inputPath } } : {}),
    })
    await assertFfmpegReady(executable)
  } catch (error) {
    if (mediaTempDir) await rm(mediaTempDir, { recursive: true, force: true })
    throw error
  }

  let session: CaptureSession | null = null
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
    session = await openCaptureSession({
      markdown: options.markdown,
      settings,
      plan,
      totalDuration,
      chromiumExecutablePath: options.chromiumExecutablePath,
      allowRemoteNetwork: options.allowRemoteNetwork ?? true,
      burnCaptions: shouldBurnCaptions,
    })

    ffmpeg = startFfmpeg(executable, ffmpegArgs, {
      ...(mediaTempDir ? { cwd: mediaTempDir } : {}),
    })
    encodingStarted = true

    const jpegQuality = Math.round(plan.frameQuality * 100)
    for (let frame = 0; frame < totalFrames; frame += 1) {
      throwIfAborted(options.signal)
      const time = Math.min(frame / fps, totalDuration)
      await session.page.evaluate((t) => window.__mv!.seek(t), time)
      const jpeg = await session.captureTarget.screenshot({
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

    if (hasCaptions) {
      await writeFile(sidecarPaths.srtPath, captionSidecars.srt, "utf8")
      await writeFile(sidecarPaths.vttPath, captionSidecars.vtt, "utf8")
    }

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
      captionCount: captionSidecars.cues.length,
      captionPaths: hasCaptions ? sidecarPaths : undefined,
      hasAudio: preparedMusic !== undefined,
      captionsBurnedIn: shouldBurnCaptions,
    }
  } catch (error) {
    ffmpeg?.abort()
    if (!outputExisted) {
      await unlink(outputPath).catch(() => undefined)
    }
    throw error
  } finally {
    if (encodingStarted) ffmpeg?.abort()
    if (session) await closeSilently(() => session!.close())
    if (mediaTempDir) await rm(mediaTempDir, { recursive: true, force: true })
  }
}

/**
 * Render a browser-quality mp4 without requiring the caller to choose or
 * protect an output path. The file still passes through a short-lived private
 * temporary directory because native ffmpeg needs a seekable output target;
 * the directory is removed before this function returns or rejects.
 */
export async function renderVideoToBuffer(
  options: RenderVideoBufferOptions,
): Promise<RenderVideoBufferResult> {
  if (
    options.maxOutputBytes !== undefined &&
    (!Number.isFinite(options.maxOutputBytes) || options.maxOutputBytes <= 0)
  ) {
    throw new UsageError("maxOutputBytes must be a positive finite number.")
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "markdown-video-render-"))
  try {
    const result = await renderVideo({
      ...options,
      outputPath: "render.mp4",
      cwd: tempDir,
      format: "mp4",
      overwrite: false,
      allowOutsideCwd: false,
    })
    const outputStats = await stat(result.outputPath)
    if (
      options.maxOutputBytes !== undefined &&
      outputStats.size > options.maxOutputBytes
    ) {
      throw new RenderError(
        `Rendered mp4 is ${outputStats.size} bytes; the limit is ${options.maxOutputBytes} bytes.`,
      )
    }

    return {
      mp4: await readFile(result.outputPath),
      format: "mp4",
      width: result.width,
      height: result.height,
      fps: result.fps,
      totalFrames: result.totalFrames,
      totalDuration: result.totalDuration,
      elapsedSeconds: result.elapsedSeconds,
      sizeBytes: outputStats.size,
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

/**
 * Capture lossless PNG screenshots at exact timeline times. This deliberately
 * does not extract frames from a rendered mp4: direct screenshots avoid a lossy
 * encode/decode round trip and cost only the requested frames.
 */
export async function renderFrames(
  options: RenderFramesOptions,
): Promise<RenderFramesResult> {
  const started = performance.now()
  validateMarkdown(options.markdown)
  if (!Array.isArray(options.times) || options.times.length === 0) {
    throw new UsageError("At least one preview frame time is required.")
  }
  if (options.times.length > MAX_PREVIEW_FRAME_COUNT) {
    throw new UsageError(
      `At most ${MAX_PREVIEW_FRAME_COUNT} preview frames can be rendered per request.`,
    )
  }
  for (const time of options.times) {
    if (!Number.isFinite(time) || time < 0) {
      throw new UsageError("Preview frame times must be finite non-negative numbers.")
    }
  }

  const settings = resolveRenderSettings({
    resolution: options.resolution,
    aspectRatio: options.aspectRatio,
    locale: options.locale,
    quality: "high",
    speed: "balanced",
    format: "mp4",
    fps: 30,
  })
  const { totalDuration } = validateRenderInput({
    markdown: options.markdown,
    fps: settings.fps,
  })
  const plan = createRenderPlan({
    resolution: settings.resolution,
    projectAspectRatio: settings.aspectRatio,
    format: settings.format,
    quality: settings.quality,
  })

  for (const time of options.times) {
    if (time - totalDuration > 1e-9) {
      throw new UsageError(
        `Preview frame time ${time}s is beyond the ${totalDuration}s video duration.`,
      )
    }
  }

  let session: CaptureSession | null = null
  try {
    throwIfAborted(options.signal)
    session = await openCaptureSession({
      markdown: options.markdown,
      settings,
      plan,
      totalDuration,
      chromiumExecutablePath: options.chromiumExecutablePath,
      allowRemoteNetwork: options.allowRemoteNetwork ?? true,
    })

    const frames: RenderedFrame[] = []
    for (const requestedTime of options.times) {
      throwIfAborted(options.signal)
      const time = Math.min(requestedTime, totalDuration)
      await session.page.evaluate((t) => window.__mv!.seek(t), time)
      const png = await session.captureTarget.screenshot({
        type: "png",
        scale: "device",
      })
      if (
        png.length < 8 ||
        png[0] !== 0x89 ||
        png[1] !== 0x50 ||
        png[2] !== 0x4e ||
        png[3] !== 0x47
      ) {
        throw new RenderError(
          `Playwright returned invalid PNG data for preview time ${requestedTime}.`,
        )
      }
      frames.push({ time, png })
    }

    return {
      frames,
      width: plan.width,
      height: plan.height,
      totalDuration,
      elapsedSeconds: (performance.now() - started) / 1000,
    }
  } finally {
    if (session) await closeSilently(() => session!.close())
  }
}
