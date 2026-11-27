import { describe, expect, it } from "vitest"

import {
  parseCliArgs,
  parseDiffCliArgs,
  parseDoctorCliArgs,
  parseInstallBrowserCliArgs,
  parsePreviewCliArgs,
} from "./args.js"
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
      "--burn-captions",
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
    expect(args.burnCaptions).toBe(true)
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

describe("parsePreviewCliArgs", () => {
  it("parses comma-separated times and JSON output options", () => {
    const args = parsePreviewCliArgs([
      "input.md",
      "--times",
      "0, 1.5,3",
      "--resolution",
      "720p",
      "--aspect-ratio",
      "1:1",
      "--locale",
      "pt-BR",
      "--json",
      "--deny-remote-network",
    ])

    expect(args).toMatchObject({
      inputPath: "input.md",
      markdown: null,
      times: [0, 1.5, 3],
      resolution: "720p",
      aspectRatio: "1:1",
      locale: "pt-BR",
      json: true,
      outputDir: null,
      denyRemoteNetwork: true,
      help: false,
    })
  })

  it("parses PNG directory output options", () => {
    const args = parsePreviewCliArgs([
      "--markdown",
      "!scene\n!text\nHello",
      "--output-dir",
      "frames",
      "--overwrite",
      "--allow-outside-cwd",
    ])

    expect(args.times).toBeUndefined()
    expect(args.outputDir).toBe("frames")
    expect(args.overwrite).toBe(true)
    expect(args.allowOutsideCwd).toBe(true)
  })

  it("rejects malformed and negative times", () => {
    expect(() =>
      parsePreviewCliArgs(["input.md", "--times", "0,,1", "--json"]),
    ).toThrow(UsageError)
    expect(() =>
      parsePreviewCliArgs(["input.md", "--times", "0,-1", "--json"]),
    ).toThrow(UsageError)
    expect(() =>
      parsePreviewCliArgs(["input.md", "--times", "abc", "--json"]),
    ).toThrow(UsageError)
  })

  it("rejects mixed input modes and extra positionals", () => {
    expect(() =>
      parsePreviewCliArgs(["input.md", "--markdown", "# Hi", "--json"]),
    ).toThrow(UsageError)
    expect(() =>
      parsePreviewCliArgs(["one.md", "two.md", "--json"]),
    ).toThrow(UsageError)
  })
})

describe("parseDiffCliArgs", () => {
  it("parses two file inputs and visual diff options", () => {
    const args = parseDiffCliArgs([
      "old.md",
      "new.md",
      "--json",
      "--out-dir",
      "diff-frames",
      "--threshold",
      "2.5",
      "--outlier-threshold",
      "30",
      "--samples-per-scene",
      "3",
      "--resolution",
      "480p",
      "--aspect-ratio",
      "1:1",
      "--locale",
      "en",
      "--overwrite",
      "--deny-remote-network",
    ])

    expect(args).toMatchObject({
      oldInputPath: "old.md",
      newInputPath: "new.md",
      json: true,
      outDir: "diff-frames",
      thresholdPercent: 2.5,
      outlierThresholdPercent: 30,
      samplesPerScene: 3,
      resolution: "480p",
      aspectRatio: "1:1",
      locale: "en",
      overwrite: true,
      denyRemoteNetwork: true,
      help: false,
    })
  })

  it("rejects invalid thresholds, sample counts, and extra positionals", () => {
    expect(() =>
      parseDiffCliArgs(["old.md", "new.md", "--threshold", "101"]),
    ).toThrow(UsageError)
    expect(() =>
      parseDiffCliArgs(["old.md", "new.md", "--outlier-threshold", "bad"]),
    ).toThrow(UsageError)
    expect(() =>
      parseDiffCliArgs(["old.md", "new.md", "--samples-per-scene", "4"]),
    ).toThrow(UsageError)
    expect(() =>
      parseDiffCliArgs(["old.md", "new.md", "third.md"]),
    ).toThrow(UsageError)
  })
})

describe("parseDoctorCliArgs", () => {
  it("parses dependency overrides", () => {
    expect(parseDoctorCliArgs([
      "--ffmpeg",
      "/opt/ffmpeg/bin/ffmpeg",
      "--chromium",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ])).toEqual({
      ffmpegPath: "/opt/ffmpeg/bin/ffmpeg",
      chromiumExecutablePath: "/Applications/Chromium.app/Contents/MacOS/Chromium",
      help: false,
    })
  })

  it("rejects unexpected positional arguments", () => {
    expect(() => parseDoctorCliArgs(["input.md"])).toThrow(UsageError)
  })
})

describe("parseInstallBrowserCliArgs", () => {
  it("parses --with-deps", () => {
    expect(parseInstallBrowserCliArgs(["--with-deps"])).toEqual({
      withDeps: true,
      help: false,
    })
  })

  it("rejects unexpected positional arguments", () => {
    expect(() => parseInstallBrowserCliArgs(["chromium"])).toThrow(UsageError)
  })
})
