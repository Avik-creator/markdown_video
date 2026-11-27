import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { PNG } from "pngjs"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { main } from "../../src/cli-main.js"

const integration = describe.skipIf(process.env.MV_SKIP_INTEGRATION === "1")

let tempDir = ""

beforeAll(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "mv-diff-integration-"))
})

afterAll(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

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

function writeDocument(name: string, markdown: string) {
  const filePath = path.join(tempDir, name)
  writeFileSync(filePath, markdown, "utf8")
  return filePath
}

function textScene(
  text: string,
  {
    duration = 1.2,
    background = "#101828",
    animated = false,
  }: {
    duration?: number
    background?: string
    animated?: boolean
  } = {},
) {
  return [
    "!scene",
    `!duration ${duration}`,
    `!background ${background}`,
    "!transition none",
    "!text",
    text,
    "size: lg",
    `animation: ${animated ? "fadeIn" : "none"}`,
    "fontFamily: sans",
  ].join("\n")
}

function textDocument(scenes: string[]) {
  return `${scenes.join("\n\n---\n\n")}\n`
}

function simpleDocument(entries: Array<{ text: string; duration?: number; background?: string }>) {
  return textDocument(entries.map((entry) => textScene(entry.text, entry)))
}

integration("diff command integration", () => {
  it("reports zero change for identical real renders", async () => {
    const documentPath = writeDocument(
      "identical.md",
      simpleDocument([
        { text: "Identical first scene", background: "#101828" },
        { text: "Identical second scene", background: "#fff4ec" },
      ]),
    )

    const result = await invokeCli([
      "diff",
      documentPath,
      documentPath,
      "--resolution",
      "480p",
      "--deny-remote-network",
    ])

    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("unchanged-content")
    expect(result.stdout).toContain("0.000%")
    expect(result.stdout).toContain("Verdict: PASS")
    expect(result.stdout).toContain("4 frame pairs compared (8 captured frames)")
  }, 30_000)

  it("detects a one-word edit in exactly the modified scene and writes comparison PNGs", async () => {
    const oldPath = writeDocument(
      "edit-old.md",
      simpleDocument([
        { text: "Intro remains stable", background: "#101828" },
        { text: "The target scene is original", background: "#182038" },
        { text: "Outro remains stable", background: "#fff4ec" },
      ]),
    )
    const newPath = writeDocument(
      "edit-new.md",
      simpleDocument([
        { text: "Intro remains stable", background: "#101828" },
        { text: "The target scene is revised", background: "#182038" },
        { text: "Outro remains stable", background: "#fff4ec" },
      ]),
    )
    const outDir = path.join(tempDir, "comparison-artifacts")

    const result = await invokeCli([
      "diff",
      oldPath,
      newPath,
      "--resolution",
      "480p",
      "--deny-remote-network",
      "--json",
      "--out-dir",
      outDir,
      "--allow-outside-cwd",
    ])

    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
    const report = JSON.parse(result.stdout) as {
      verdict: string
      dimensions: { width: number; height: number }
      summary: Record<string, number>
      scenes: Array<{
        status: string
        old: { index: number } | null
        new: { index: number } | null
        comparison: {
          meanChangePercent: number
          samples: Array<{ comparisonImagePath: string | null }>
        } | null
      }>
    }

    expect(Object.keys(report)).toEqual([
      "version",
      "verdict",
      "inputs",
      "settings",
      "dimensions",
      "summary",
      "scenes",
    ])
    expect(report.verdict).toBe("pass")
    expect(report.summary.added).toBe(0)
    expect(report.summary.removed).toBe(0)
    expect(report.summary.comparedFramePairs).toBe(6)
    expect(report.summary.capturedFrames).toBe(12)
    const modified = report.scenes.find((scene) => scene.status === "modified")
    expect(modified?.old?.index).toBe(1)
    expect(modified?.new?.index).toBe(1)
    expect(modified?.comparison?.meanChangePercent).toBeGreaterThan(0)
    expect(
      report.scenes
        .filter((scene) => scene.status === "unchanged-content")
        .map((scene) => scene.old?.index),
    ).toEqual([0, 2])
    expect(report.scenes.every((scene) => scene.comparison !== null)).toBe(true)

    const artifacts = readdirSync(outDir).filter((name) => name.endsWith(".png"))
    expect(artifacts).toHaveLength(6)
    const artifactPath = modified?.comparison?.samples[0]?.comparisonImagePath
    expect(artifactPath).not.toBeNull()
    const composite = PNG.sync.read(readFileSync(artifactPath!))
    expect(composite.width).toBe(report.dimensions.width * 3 + 4)
    expect(composite.height).toBe(report.dimensions.height)
  }, 30_000)

  it("classifies a duration-only edit as retimed and fails unchanged render differences", async () => {
    const shakeScene = (duration: number) => [
      "!scene",
      `!duration ${duration}`,
      "!background #101828",
      "!camera shake",
      "!text",
      "Retimed animated text",
      "size: lg",
      "animation: none",
      "fontFamily: sans",
    ].join("\n")
    const oldPath = writeDocument("retimed-old.md", `${shakeScene(2)}\n`)
    const newPath = writeDocument("retimed-new.md", `${shakeScene(4)}\n`)

    const result = await invokeCli([
      "diff",
      oldPath,
      newPath,
      "--resolution",
      "480p",
      "--deny-remote-network",
    ])

    expect(result.code).toBe(3)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("retimed")
    expect(result.stdout).toContain("UNEXPECTED: unchanged scene content")
    expect(result.stdout).toContain("Verdict: FAIL — 1 unexpected scene change")
  }, 30_000)

  it("aligns reordered scenes by content instead of treating them as unrelated edits", async () => {
    const sceneA = textScene("Alpha movable", { background: "#101828" })
    const sceneB = textScene("Beta movable", { background: "#203040" })
    const sceneC = textScene("Gamma fixed", { background: "#fff4ec" })
    const oldPath = writeDocument("reorder-old.md", textDocument([sceneA, sceneB, sceneC]))
    const newPath = writeDocument("reorder-new.md", textDocument([sceneB, sceneA, sceneC]))

    const result = await invokeCli([
      "diff",
      oldPath,
      newPath,
      "--resolution",
      "480p",
      "--deny-remote-network",
      "--json",
    ])

    expect(result.code).toBe(0)
    const report = JSON.parse(result.stdout) as {
      scenes: Array<{
        status: string
        old: { index: number } | null
        new: { index: number } | null
        comparison: { meanChangePercent: number } | null
      }>
      summary: Record<string, number>
    }
    expect(report.summary.added).toBe(0)
    expect(report.summary.removed).toBe(0)
    expect(report.scenes.find((scene) => scene.old?.index === 0)?.new?.index).toBe(1)
    expect(report.scenes.find((scene) => scene.old?.index === 1)?.new?.index).toBe(0)
    expect(report.scenes.find((scene) => scene.old?.index === 2)?.status).toBe("unchanged-content")
    expect(report.scenes.filter((scene) => scene.status === "retimed")).toHaveLength(2)
    expect(report.scenes.every((scene) => scene.comparison?.meanChangePercent === 0)).toBe(true)
  }, 30_000)
})
