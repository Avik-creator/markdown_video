import { createServer, type IncomingMessage, type ServerResponse } from "node:http"

import { UsageError } from "markdown-video"
import { ZodError } from "zod"

import type { RenderWorkerConfig } from "./config.js"
import {
  HttpError,
  isAuthorizedBearer,
  readJsonBody,
  sendJson,
} from "./http-utils.js"
import { RenderQueue, RenderQueueFullError } from "./queue.js"
import {
  renderPreviewJob,
  renderVideoJob,
  type PreviewRenderOutput,
  type VideoRenderOutput,
} from "./rendering.js"
import {
  MAX_RENDER_REQUEST_BODY_BYTES,
  previewRequestSchema,
  videoRequestSchema,
  type PreviewRequestInput,
  type VideoRequestInput,
} from "./schemas.js"

const PREVIEW_TIMEOUT_MS = 20_000
const VIDEO_TIMEOUT_MS = 45_000

export interface RenderWorkerTimeoutOverrides {
  previewTimeoutMs?: number
  videoTimeoutMs?: number
  queueWaitTimeoutMs?: number
}

export interface RenderWorkerRenderers {
  renderPreview(
    input: PreviewRequestInput,
    signal: AbortSignal,
  ): Promise<PreviewRenderOutput>
  renderVideo(
    input: VideoRequestInput,
    signal: AbortSignal,
  ): Promise<VideoRenderOutput>
}

function methodNotAllowed(response: ServerResponse, allow: string) {
  sendJson(response, 405, { error: "Method not allowed" }, { allow })
}

function notFound(response: ServerResponse) {
  sendJson(response, 404, { error: "Not found" })
}

function formatZodError(error: ZodError) {
  return error.issues
    .slice(0, 6)
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : ""
      return `${path}${issue.message}`
    })
    .join("; ")
}

function createTimeout(timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  // The request itself keeps the process alive; the timer should not be an
  // additional reason a shutdown or short test process stays open.
  timer.unref()
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}

class RenderQueueWaitTimeoutError extends Error {
  constructor() {
    super("Render worker is busy; queue wait timed out")
    this.name = "RenderQueueWaitTimeoutError"
  }
}

function renderTimeoutError() {
  const error = new Error("Render timed out")
  error.name = "AbortError"
  return error
}

async function runWithExecutionTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const timeout = createTimeout(timeoutMs)
  try {
    return await operation(timeout.signal)
  } catch (error) {
    if (timeout.signal.aborted && !isAbortLike(error)) {
      throw renderTimeoutError()
    }
    throw error
  } finally {
    timeout.clear()
  }
}

async function handleRequest({
  request,
  response,
  config,
  queue,
  renderers,
  timeouts,
}: {
  request: IncomingMessage
  response: ServerResponse
  config: RenderWorkerConfig
  queue: RenderQueue
  renderers: RenderWorkerRenderers
  timeouts: Required<Pick<RenderWorkerTimeoutOverrides, "previewTimeoutMs" | "videoTimeoutMs">> &
    Pick<RenderWorkerTimeoutOverrides, "queueWaitTimeoutMs">
}) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)

  if (url.pathname === "/health") {
    if (request.method !== "GET") {
      methodNotAllowed(response, "GET")
      return
    }
    sendJson(response, 200, {
      ok: true,
      activeRenders: queue.activeCount,
      queuedRenders: queue.waitingCount,
      concurrency: config.concurrency,
      queueLimit: config.queueLimit,
    })
    return
  }

  if (url.pathname !== "/v1/preview" && url.pathname !== "/v1/video") {
    notFound(response)
    return
  }

  if (request.method !== "POST") {
    methodNotAllowed(response, "POST")
    return
  }

  if (!isAuthorizedBearer(request.headers.authorization, config.sharedSecret)) {
    sendJson(
      response,
      401,
      { error: "A valid bearer token is required" },
      { "www-authenticate": "Bearer" },
    )
    return
  }

  const body = await readJsonBody(request, MAX_RENDER_REQUEST_BODY_BYTES)
  const timeoutMs = url.pathname === "/v1/preview"
    ? timeouts.previewTimeoutMs
    : timeouts.videoTimeoutMs
  // Queue wait is a separate admission-control budget. Once the job leaves
  // the queue this timer is cleared and the renderer receives its full
  // execution timeout; otherwise a busy worker would silently spend part (or
  // all) of the execution budget before Chromium even started.
  const queueWait = createTimeout(timeouts.queueWaitTimeoutMs ?? timeoutMs)
  const runQueued = <T>(render: (signal: AbortSignal) => Promise<T>) =>
    queue.run(
      () => {
        queueWait.clear()
        return runWithExecutionTimeout(timeoutMs, render)
      },
      queueWait.signal,
    )

  try {
    if (url.pathname === "/v1/preview") {
      const input = previewRequestSchema.parse(body)
      const output = await runQueued((signal) => renderers.renderPreview(input, signal))
      sendJson(response, 200, output)
      return
    }

    const input = videoRequestSchema.parse(body)
    const output = await runQueued((signal) => renderers.renderVideo(input, signal))
    response.writeHead(200, {
      "content-type": "video/mp4",
      "content-length": output.mp4.byteLength,
      "cache-control": "no-store",
      "content-disposition": "inline; filename=\"markdown-video.mp4\"",
      "x-content-type-options": "nosniff",
      "x-mv-duration": output.duration.toFixed(3),
      "x-mv-width": String(output.width),
      "x-mv-height": String(output.height),
      "x-mv-fps": String(output.fps),
      "x-mv-frames": String(output.totalFrames),
      "x-mv-elapsed-seconds": output.elapsedSeconds.toFixed(3),
    })
    response.end(output.mp4)
  } catch (error) {
    if (queueWait.signal.aborted) {
      throw new RenderQueueWaitTimeoutError()
    }
    throw error
  } finally {
    queueWait.clear()
  }
}

function isAbortLike(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "RenderCancelledError")
  )
}

function sendError(response: ServerResponse, error: unknown) {
  if (error instanceof HttpError) {
    sendJson(response, error.status, { error: error.message })
    return
  }
  if (error instanceof ZodError) {
    sendJson(response, 400, { error: `Invalid request: ${formatZodError(error)}` })
    return
  }
  if (error instanceof RenderQueueWaitTimeoutError) {
    sendJson(response, 503, { error: error.message }, { "retry-after": "5" })
    return
  }
  if (error instanceof RenderQueueFullError) {
    sendJson(response, 429, { error: error.message }, { "retry-after": "5" })
    return
  }
  if (error instanceof UsageError) {
    sendJson(response, 422, { error: error.message })
    return
  }
  if (isAbortLike(error)) {
    sendJson(response, 504, { error: "Render timed out" })
    return
  }

  console.error("[render-worker] unexpected render failure", error)
  sendJson(response, 500, { error: "Render failed" })
}

export function createRenderWorkerServer(
  config: RenderWorkerConfig,
  rendererOverrides: Partial<RenderWorkerRenderers> = {},
  timeoutOverrides: RenderWorkerTimeoutOverrides = {},
) {
  const queue = new RenderQueue(config.concurrency, config.queueLimit)
  const renderers: RenderWorkerRenderers = {
    renderPreview: renderPreviewJob,
    renderVideo: renderVideoJob,
    ...rendererOverrides,
  }
  const timeouts = {
    previewTimeoutMs: timeoutOverrides.previewTimeoutMs ?? PREVIEW_TIMEOUT_MS,
    videoTimeoutMs: timeoutOverrides.videoTimeoutMs ?? VIDEO_TIMEOUT_MS,
    ...(timeoutOverrides.queueWaitTimeoutMs !== undefined
      ? { queueWaitTimeoutMs: timeoutOverrides.queueWaitTimeoutMs }
      : {}),
  }

  const server = createServer((request, response) => {
    handleRequest({ request, response, config, queue, renderers, timeouts }).catch((error) => {
      if (!response.headersSent) {
        sendError(response, error)
      } else {
        console.error("[render-worker] error after response headers were sent", error)
        response.destroy(error instanceof Error ? error : undefined)
      }
    })
  })

  // Bound slow/infinite request bodies independently of render timeouts. The
  // JSON cap is small, so one minute is generous even for very weak clients.
  server.requestTimeout = 60_000
  server.headersTimeout = 15_000
  return server
}

export { PREVIEW_TIMEOUT_MS, VIDEO_TIMEOUT_MS }
