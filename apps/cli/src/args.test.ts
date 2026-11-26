import { describe, expect, it } from "vitest"

import { parseCliArgs } from "./args.js"
import { UsageError } from "./errors.js"

describe("parseCliArgs", () => {
  it("parses file input and output options", () => {
    const args = parseCliArgs([
      "render",
      "input.md",
      "--output",
      "out.mp4",
      "--resolution",
      "720p",
      "--quality",
      "medium",
      "--speed",
      "fast",
      "--aspect-ratio",
      "9:16",
      "--fps",
      "24",
      "--overwrite",
    ])

    expect(args.command).toBe("render")
    expect(args.inputPath).toBe("input.md")
    expect(args.outputPath).toBe("out.mp4")
    expect(args.resolution).toBe("720p")
    expect(args.quality).toBe("medium")
    expect(args.speed).toBe("fast")
    expect(args.aspectRatio).toBe("9:16")
    expect(args.fps).toBe(24)
    expect(args.overwrite).toBe(true)
    expect(args.denyRemoteNetwork).toBe(false)
  })

  it("parses the loopback-only browser network flag", () => {
    const args = parseCliArgs([
      "input.md",
      "-o",
      "out.mp4",
      "--deny-remote-network",
    ])

    expect(args.denyRemoteNetwork).toBe(true)
  })

  it("supports inline markdown and rejects mixed input modes", () => {
    expect(parseCliArgs(["--markdown", "# Hi", "-o", "x.mp4"]).markdown).toBe(
      "# Hi",
    )
    expect(() =>
      parseCliArgs(["input.md", "--markdown", "# Hi", "-o", "x.mp4"]),
    ).toThrow(UsageError)
  })

  it("rejects invalid numeric fps", () => {
    expect(() => parseCliArgs(["input.md", "-o", "x.mp4", "--fps", "bad"])).toThrow(
      UsageError,
    )
  })
})
