import { describe, expect, it } from "vitest"

import { loadWorkerConfig, WorkerConfigurationError } from "./config.js"

const secret = "x".repeat(32)

describe("loadWorkerConfig", () => {
  it("fails closed when the shared secret is missing", () => {
    expect(() => loadWorkerConfig({})).toThrow(WorkerConfigurationError)
    expect(() => loadWorkerConfig({})).toThrow(/refusing to start/i)
  })

  it("rejects weak shared secrets", () => {
    expect(() =>
      loadWorkerConfig({ RENDER_WORKER_SHARED_SECRET: "too-short" }),
    ).toThrow(/at least 32 characters/i)
  })

  it("uses conservative defaults", () => {
    expect(loadWorkerConfig({ RENDER_WORKER_SHARED_SECRET: secret })).toEqual({
      host: "0.0.0.0",
      port: 8080,
      sharedSecret: secret,
      concurrency: 1,
      queueLimit: 8,
    })
  })

  it("parses bounded overrides", () => {
    expect(
      loadWorkerConfig({
        RENDER_WORKER_SHARED_SECRET: secret,
        PORT: "9123",
        HOST: "127.0.0.1",
        RENDER_WORKER_CONCURRENCY: "2",
        RENDER_WORKER_QUEUE_LIMIT: "3",
      }),
    ).toMatchObject({
      host: "127.0.0.1",
      port: 9123,
      concurrency: 2,
      queueLimit: 3,
    })
  })

  it.each([
    ["PORT", "0"],
    ["RENDER_WORKER_CONCURRENCY", "5"],
    ["RENDER_WORKER_QUEUE_LIMIT", "65"],
  ])("rejects invalid %s values", (name, value) => {
    expect(() =>
      loadWorkerConfig({
        RENDER_WORKER_SHARED_SECRET: secret,
        [name]: value,
      }),
    ).toThrow(WorkerConfigurationError)
  })
})
