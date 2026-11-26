import type { Server } from "node:http"

import { afterEach, describe, expect, it, vi } from "vitest"

import type { RenderWorkerConfig } from "./config.js"
import { createRenderWorkerServer, type RenderWorkerRenderers } from "./server.js"

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

async function startServer(renderers = rendererOverrides()) {
  const server = createRenderWorkerServer(config(), renderers)
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
