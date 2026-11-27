import path from "node:path"
import { fileURLToPath } from "node:url"

import { PNG } from "pngjs"
import { describe, expect, it, vi } from "vitest"

import { main } from "../../src/cli-main.js"
import { UsageError } from "../../src/errors.js"

const integration = describe.skipIf(process.env.MV_SKIP_INTEGRATION === "1")
const testDir = path.dirname(fileURLToPath(import.meta.url))
const cliDir = path.resolve(testDir, "../..")
const fixturePath = path.join(cliDir, "fixtures/render-fixture.md")

function writeOutput(calls: unknown[][]) {
  return calls.map((call) => String(call[0])).join("")
}

async function invokeCli(args: string[]) {
  const stdoutWrite = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(() => true)
  const stderrWrite = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true)
  try {
    const code = await main(args)
    return {
      code,
      stdout: writeOutput(stdoutWrite.mock.calls),
      stderr: writeOutput(stderrWrite.mock.calls),
    }
  } finally {
    stdoutWrite.mockRestore()
    stderrWrite.mockRestore()
  }
}

integration("preview command integration", () => {
  it("emits the exact JSON preview contract with real lossless PNG frames", async () => {
    const result = await invokeCli([
      "preview",
      fixturePath,
      "--times",
      "0,2,4",
      "--resolution",
      "480p",
      "--json",
      "--deny-remote-network",
    ])

    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout.endsWith("\n")).toBe(true)

    const payload = JSON.parse(result.stdout) as {
      duration: number
      width: number
      height: number
      frames: Array<{ time: number; pngBase64: string }>
    }
    expect(Object.keys(payload)).toEqual(["duration", "width", "height", "frames"])
    expect(payload.duration).toBe(4)
    expect(payload.width).toBe(854)
    expect(payload.height).toBe(480)
    expect(payload.frames.map((frame) => frame.time)).toEqual([0, 2, 4])
    expect(payload.frames).toHaveLength(3)

    for (const frame of payload.frames) {
      const png = Buffer.from(frame.pngBase64, "base64")
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
      const decoded = PNG.sync.read(png)
      expect(decoded.width).toBe(854)
      expect(decoded.height).toBe(480)
    }
  }, 60_000)

  it("validates requested times against the parsed duration", async () => {
    await expect(
      invokeCli([
        "preview",
        fixturePath,
        "--times",
        "0,4.1",
        "--resolution",
        "480p",
        "--json",
      ]),
    ).rejects.toThrow(UsageError)
  }, 10_000)

  it("uses five inclusive default times when --times is omitted", async () => {
    const result = await invokeCli([
      "preview",
      fixturePath,
      "--resolution",
      "480p",
      "--json",
    ])

    expect(result.code).toBe(0)
    const payload = JSON.parse(result.stdout) as {
      frames: Array<{ time: number }>
    }
    expect(payload.frames.map((frame) => frame.time)).toEqual([0, 1, 2, 3, 4])
  }, 60_000)
})
