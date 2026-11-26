import { createServer, type Server } from "node:http"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { RenderWorkerConfig } from "../../src/config.js"
import { createRenderWorkerServer } from "../../src/server.js"

const describeIntegration =
  process.env.MV_SKIP_INTEGRATION === "1" ? describe.skip : describe

const secret = "integration-test-secret-with-32-chars"
const testDir = path.dirname(fileURLToPath(import.meta.url))
const cliFixturePath = path.resolve(
  testDir,
  "../../../cli/fixtures/render-fixture.md",
)
const fixtureMarkdown = readFileSync(cliFixturePath, "utf8")

function config(): RenderWorkerConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    sharedSecret: secret,
    concurrency: 1,
    queueLimit: 2,
  }
}

let server: Server
let baseUrl = ""

beforeAll(async () => {
  server = createRenderWorkerServer(config())
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("server did not bind")
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})

function postJson(pathname: string, body: unknown) {
  return fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  })
}

describeIntegration("render worker end-to-end", () => {
  it("renders direct PNG preview frames through the HTTP API", async () => {
    const response = await postJson("/v1/preview", {
      markdown: fixtureMarkdown,
      times: [0, 1, 3],
    })

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      duration: number
      width: number
      height: number
      frames: Array<{ time: number; pngBase64: string }>
    }
    expect(payload.duration).toBe(4)
    expect(payload.width).toBe(1280)
    expect(payload.height).toBe(720)
    expect(payload.frames.map((frame) => frame.time)).toEqual([0, 1, 3])
    expect(payload.frames).toHaveLength(3)
    for (const frame of payload.frames) {
      const png = Buffer.from(frame.pngBase64, "base64")
      expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      expect(png.byteLength).toBeGreaterThan(1_000)
    }
  }, 60_000)

  it("renders an mp4 through the HTTP API", async () => {
    const response = await postJson("/v1/video", {
      markdown: "!scene\n!duration 1\n!text\nWorker video",
      options: {
        resolution: "480p",
        quality: "low",
        speed: "fastest",
        fps: 6,
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("video/mp4")
    expect(response.headers.get("x-mv-width")).toBe("854")
    expect(response.headers.get("x-mv-height")).toBe("480")
    expect(response.headers.get("x-mv-fps")).toBe("6")
    expect(response.headers.get("x-mv-frames")).toBe("6")
    const mp4 = Buffer.from(await response.arrayBuffer())
    expect(mp4.byteLength).toBeGreaterThan(1_000)
    expect(mp4.subarray(4, 8).toString("ascii")).toBe("ftyp")
  }, 60_000)

  it("does not let image scenes make remote network requests", async () => {
    let remoteImageRequests = 0
    const imageServer = createServer((_request, response) => {
      remoteImageRequests += 1
      response.writeHead(200, { "content-type": "image/png" })
      response.end(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64",
        ),
      )
    })
    await new Promise<void>((resolve) => {
      imageServer.listen(0, "127.0.0.1", () => resolve())
    })

    try {
      const address = imageServer.address()
      if (!address || typeof address === "string") throw new Error("image server did not bind")
      const response = await postJson("/v1/preview", {
        markdown:
          `!scene\n!duration 1\n!image src:http://127.0.0.1:${address.port}/pixel.png fit:contain`,
        times: [0, 0.5, 1],
      })

      expect(response.status).toBe(200)
      expect(remoteImageRequests).toBe(0)
    } finally {
      imageServer.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        imageServer.close((error) => (error ? reject(error) : resolve()))
      })
    }
  }, 60_000)
})
