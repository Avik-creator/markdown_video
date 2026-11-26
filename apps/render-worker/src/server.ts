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
    wasTimedOut: () => controller.signal.aborted,
    clear: () => clearTimeout(timer),
  }
}

async function handleRequest({
  request,
  response,
  config,
  queue,
  renderers,
}: {
  request: IncomingMessage
  response: ServerResponse
  config: RenderWorkerConfig
  queue: RenderQueue
  renderers: RenderWorkerRenderers
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
  const timeoutMs = url.pathname === "/v1/preview" ? PREVIEW_TIMEOUT_MS : VIDEO_TIMEOUT_MS
  const timeout = createTimeout(timeoutMs)

  try {
    if (url.pathname === "/v1/preview") {
      const input = previewRequestSchema.parse(body)
      const output = await queue.run(
        (signal) => renderers.renderPreview(input, signal),
        timeout.signal,
      )
      sendJson(response, 200, output)
      return
    }

    const input = videoRequestSchema.parse(body)
    const output = await queue.run(
      (signal) => renderers.renderVideo(input, signal),
      timeout.signal,
    )
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
    if (timeout.signal.aborted && !isAbortLike(error)) {
      const timeoutError = new Error("Render timed out")
      timeoutError.name = "AbortError"
      throw timeoutError
    }
    throw error
  } finally {
    timeout.clear()
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
) {
  const queue = new RenderQueue(config.concurrency, config.queueLimit)
  const renderers: RenderWorkerRenderers = {
    renderPreview: renderPreviewJob,
    renderVideo: renderVideoJob,
    ...rendererOverrides,
  }

  const server = createServer((request, response) => {
    handleRequest({ request, response, config, queue, renderers }).catch((error) => {
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
