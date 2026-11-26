import { describe, expect, it } from "vitest"

import { RenderQueue, RenderQueueFullError } from "./queue.js"

function neverAborted() {
  return new AbortController().signal
}

describe("RenderQueue", () => {
  it("serializes operations at concurrency one", async () => {
    const queue = new RenderQueue(1, 4)
    const events: string[] = []

    await Promise.all([
      queue.run(async () => {
        events.push("first:start")
        await new Promise((resolve) => setTimeout(resolve, 5))
        events.push("first:end")
      }, neverAborted()),
      queue.run(async () => {
        events.push("second:start")
      }, neverAborted()),
    ])

    expect(events).toEqual(["first:start", "first:end", "second:start"])
  })

  it("bounds the number of waiting operations", async () => {
    const queue = new RenderQueue(1, 1)
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = queue.run(() => firstGate, neverAborted())
    const second = queue.run(async () => "second", neverAborted())
    await expect(queue.run(async () => "third", neverAborted())).rejects.toBeInstanceOf(
      RenderQueueFullError,
    )

    releaseFirst()
    await expect(first).resolves.toBeUndefined()
    await expect(second).resolves.toBe("second")
  })

  it("removes a queued operation when its signal aborts", async () => {
    const queue = new RenderQueue(1, 2)
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const abort = new AbortController()

    const first = queue.run(() => firstGate, neverAborted())
    const second = queue.run(async () => "second", abort.signal)
    abort.abort()

    await expect(second).rejects.toMatchObject({ name: "AbortError" })
    expect(queue.waitingCount).toBe(0)
    releaseFirst()
    await first
  })
})
