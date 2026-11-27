import type { Server } from "node:http"

import { afterEach, describe, expect, it, vi } from "vitest"

import type { RenderWorkerConfig } from "./config.js"
import {
  createRenderWorkerServer,
  type RenderWorkerRenderers,
  type RenderWorkerTimeoutOverrides,
} from "./server.js"

const secret = "worker-test-secret-with-32-chars"
const markdown = "!scene\n!duration 1\n!text\nHello"

function config(overrides: Partial<RenderWorkerConfig> = {}): RenderWorkerConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    sharedSecret: secret,
    concurrency: 1,
    queueLimit: 2,
    ...overrides,
  }
}

function rendererOverrides(): RenderWorkerRenderers {
  return {
    renderPreview: vi.fn(async () => ({
      duration: 1,
      width: 1280,
      height: 720,
      frames: [{ time: 0, pngBase64: Buffer.from("png").toString("base64") }],
    })),
    renderVideo: vi.fn(async () => ({
      mp4: Buffer.from("fake-mp4"),
      duration: 1,
      width: 1280,
      height: 720,
      fps: 24,
      totalFrames: 24,
      sizeBytes: 8,
      elapsedSeconds: 0.25,
    })),
  }
}

const openServers: Server[] = []

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections()
          server.close((error) => (error ? reject(error) : resolve()))
        }),
    ),
  )
})

async function startServer(
  renderers = rendererOverrides(),
  timeoutOverrides: RenderWorkerTimeoutOverrides = {},
) {
  const server = createRenderWorkerServer(config(), renderers, timeoutOverrides)
  openServers.push(server)
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("server did not bind")
  return `http://127.0.0.1:${address.port}`
}

function postJson(url: string, body: unknown, authorized = true) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorized ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

function videoOutput(elapsedSeconds = 0.25) {
  return {
    mp4: Buffer.from("fake-mp4"),
    duration: 1,
    width: 1280,
    height: 720,
    fps: 24,
    totalFrames: 24,
    sizeBytes: 8,
    elapsedSeconds,
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

describe("render worker HTTP service", () => {
  it("exposes an unauthenticated health endpoint", async () => {
    const baseUrl = await startServer()
    const response = await fetch(`${baseUrl}/health`)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      activeRenders: 0,
      queuedRenders: 0,
      concurrency: 1,
    })
  })

  it("rejects render requests without a valid bearer token", async () => {
    const baseUrl = await startServer()
    const response = await postJson(`${baseUrl}/v1/preview`, { markdown }, false)

    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toBe("Bearer")
  })

  it("validates preview input before invoking the renderer", async () => {
    const renderers = rendererOverrides()
    const baseUrl = await startServer(renderers)
    const response = await postJson(`${baseUrl}/v1/preview`, {
      markdown,
      times: [0],
    })

    expect(response.status).toBe(400)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toMatch(/invalid request/i)
    expect(renderers.renderPreview).not.toHaveBeenCalled()
  })

  it("returns preview frames as base64 JSON", async () => {
    const renderers = rendererOverrides()
    const baseUrl = await startServer(renderers)
    const response = await postJson(`${baseUrl}/v1/preview`, {
      markdown,
      times: [0, 0.5, 1],
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      duration: 1,
      width: 1280,
      height: 720,
      frames: [{ time: 0, pngBase64: Buffer.from("png").toString("base64") }],
    })
    expect(renderers.renderPreview).toHaveBeenCalledWith(
      expect.objectContaining({ markdown }),
      expect.any(AbortSignal),
    )
  })

  it("returns video bytes with render metadata headers", async () => {
    const baseUrl = await startServer()
    const response = await postJson(`${baseUrl}/v1/video`, {
      markdown,
      options: { resolution: "720p", fps: 24 },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("video/mp4")
    expect(response.headers.get("x-mv-duration")).toBe("1.000")
    expect(response.headers.get("x-mv-width")).toBe("1280")
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-mp4")
  })

  it("gives a queued video its full execution timeout after dequeue", async () => {
    let invocation = 0
    const renderers: RenderWorkerRenderers = {
      ...rendererOverrides(),
      renderVideo: vi.fn(async () => {
        invocation += 1
        await delay(invocation === 1 ? 60 : 50)
        return videoOutput()
      }),
    }
    const baseUrl = await startServer(renderers, {
      videoTimeoutMs: 100,
      queueWaitTimeoutMs: 1_000,
    })

    const firstPromise = postJson(`${baseUrl}/v1/video`, { markdown })
    await delay(10)
    const secondPromise = postJson(`${baseUrl}/v1/video`, { markdown })
    const [first, second] = await Promise.all([firstPromise, secondPromise])

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(renderers.renderVideo).toHaveBeenCalledTimes(2)
  })

  it("still enforces the execution timeout after rendering starts", async () => {
    const renderers: RenderWorkerRenderers = {
      ...rendererOverrides(),
      renderVideo: vi.fn(async (_input, signal) => {
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              const error = new Error("cancelled")
              error.name = "AbortError"
              reject(error)
            },
            { once: true },
          )
        })
        return videoOutput()
      }),
    }
    const baseUrl = await startServer(renderers, {
      videoTimeoutMs: 30,
      queueWaitTimeoutMs: 1_000,
    })

    const response = await postJson(`${baseUrl}/v1/video`, { markdown })

    expect(response.status).toBe(504)
    expect(await response.json()).toEqual({ error: "Render timed out" })
  })

  it("returns an honest busy error when the queue wait deadline expires", async () => {
    let releaseFirst!: () => void
    let markFirstStarted!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve
    })
    let invocation = 0
    const renderers: RenderWorkerRenderers = {
      ...rendererOverrides(),
      renderVideo: vi.fn(async () => {
        invocation += 1
        if (invocation === 1) {
          markFirstStarted()
          await firstGate
        }
        return videoOutput()
      }),
    }
    const baseUrl = await startServer(renderers, {
      videoTimeoutMs: 200,
      queueWaitTimeoutMs: 30,
    })

    const firstPromise = postJson(`${baseUrl}/v1/video`, { markdown })
    await firstStarted
    const second = await postJson(`${baseUrl}/v1/video`, { markdown })

    expect(second.status).toBe(503)
    expect(second.headers.get("retry-after")).toBe("5")
    expect(await second.json()).toEqual({
      error: "Render worker is busy; queue wait timed out",
    })

    releaseFirst()
    const first = await firstPromise
    expect(first.status).toBe(200)
  })

  it("enforces the request body cap before validation", async () => {
    const baseUrl = await startServer()
    const response = await postJson(`${baseUrl}/v1/preview`, {
      markdown,
      padding: "x".repeat(512 * 1024),
    })

    expect(response.status).toBe(413)
  })

  it("rejects unsupported methods explicitly", async () => {
    const baseUrl = await startServer()
    const response = await fetch(`${baseUrl}/v1/preview`, { method: "GET" })

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("POST")
  })
})
