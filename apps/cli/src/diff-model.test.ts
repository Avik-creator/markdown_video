import { describe, expect, it } from "vitest"

import {
  aggregateChangePercents,
  alignSceneFingerprints,
  canonicalSceneContent,
  classifyRenderChange,
  createFrameSamplePlan,
  DEFAULT_OUTLIER_THRESHOLD_PERCENT,
  DEFAULT_UNCHANGED_THRESHOLD_PERCENT,
  fingerprintDiffDocument,
  hashSceneContent,
  unexpectedReasonsForScene,
} from "./diff-model.js"
import { parseMarkdown } from "@markdown-video/core"

function textScene(
  text: string,
  {
    duration = 2,
    typeBlock,
  }: {
    duration?: number
    typeBlock?: string
  } = {},
) {
  return [
    "!scene",
    `!duration ${duration}`,
    typeBlock ?? `!text\n${text}`,
  ].join("\n")
}

function documentFor(scenes: string[]) {
  return `${scenes.join("\n\n---\n\n")}\n`
}

function textDocument(entries: Array<string | { text: string; duration: number }>) {
  return documentFor(
    entries.map((entry) =>
      typeof entry === "string"
        ? textScene(entry)
        : textScene(entry.text, { duration: entry.duration }),
    ),
  )
}

function alignMarkdown(oldMarkdown: string, newMarkdown: string) {
  const oldDocument = fingerprintDiffDocument(oldMarkdown)
  const newDocument = fingerprintDiffDocument(newMarkdown)
  return alignSceneFingerprints(oldDocument.scenes, newDocument.scenes)
}

describe("scene content fingerprints", () => {
  it("is deterministic across random parser ids and ignores top-level duration", () => {
    const markdown = textDocument([{ text: "Hello deterministic output", duration: 2 }])
    const first = parseMarkdown(markdown)[0]!
    const second = parseMarkdown(markdown)[0]!
    const longer = parseMarkdown(textDocument([{ text: "Hello deterministic output", duration: 5 }]))[0]!

    expect(first.id).not.toBe(second.id)
    expect(hashSceneContent(first)).toBe(hashSceneContent(second))
    expect(hashSceneContent(first)).toBe(hashSceneContent(longer))
  })

  it("distinguishes explicit backgrounds but normalizes positional implicit backgrounds", () => {
    const implicitScene = parseMarkdown(textScene("Reordered"))[0]!
    const explicitScene = parseMarkdown(`${textScene("Reordered")}\n!background #fff000\n`)[0]!
    const implicitCanonical = canonicalSceneContent(implicitScene) as Record<string, unknown>
    const explicitCanonical = canonicalSceneContent(explicitScene) as Record<string, unknown>

    expect(implicitCanonical.background).toBeUndefined()
    expect(explicitCanonical.background).toBe("#fff000")
    expect(hashSceneContent(implicitScene)).not.toBe(hashSceneContent(explicitScene))
  })
})

describe("alignSceneFingerprints", () => {
  it("aligns identical documents as unchanged-content", () => {
    const markdown = textDocument(["Alpha", "Beta", "Gamma"])
    const rows = alignMarkdown(markdown, markdown)

    expect(rows.map((row) => row.status)).toEqual([
      "unchanged-content",
      "unchanged-content",
      "unchanged-content",
    ])
    expect(rows.map((row) => [row.old?.index, row.new?.index])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ])
  })

  it("matches stable scenes across an insertion and reports only the inserted scene added", () => {
    const rows = alignMarkdown(
      textDocument(["Alpha", "Beta"]),
      textDocument(["Alpha", "Inserted", "Beta"]),
    )

    expect(rows.map((row) => row.status)).toEqual([
      "unchanged-content",
      "added",
      "retimed",
    ])
    expect(rows.find((row) => row.new?.type === "text" && row.status === "added")?.new?.index).toBe(1)
    const beta = rows.find((row) => row.old?.index === 1 && row.new?.index === 2)
    expect(beta?.status).toBe("retimed")
    expect(rows.filter((row) => row.status === "removed")).toHaveLength(0)
  })

  it("matches stable scenes across a deletion and reports only the deleted scene removed", () => {
    const rows = alignMarkdown(
      textDocument(["Alpha", "Deleted", "Beta"]),
      textDocument(["Alpha", "Beta"]),
    )

    expect(rows.map((row) => row.status)).toEqual([
      "unchanged-content",
      "removed",
      "retimed",
    ])
    expect(rows.filter((row) => row.status === "removed")).toHaveLength(1)
    expect(rows.find((row) => row.status === "removed")?.old?.index).toBe(1)
    expect(rows.find((row) => row.old?.index === 2 && row.new?.index === 1)?.status).toBe("retimed")
    expect(rows.filter((row) => row.status === "added")).toHaveLength(0)
  })

  it("aligns reordered scenes by content rather than by index", () => {
    const rows = alignMarkdown(
      textDocument(["Alpha", "Beta", "Gamma"]),
      textDocument(["Beta", "Alpha", "Gamma"]),
    )

    expect(rows.filter((row) => row.status === "added" || row.status === "removed")).toHaveLength(0)
    expect(rows.find((row) => row.old?.index === 0)?.new?.index).toBe(1)
    expect(rows.find((row) => row.old?.index === 1)?.new?.index).toBe(0)
    expect(rows.find((row) => row.old?.index === 2)?.status).toBe("unchanged-content")
    expect(rows.find((row) => row.old?.index === 0)?.status).toBe("retimed")
  })

  it("aligns a similar same-type edit as modified", () => {
    const rows = alignMarkdown(
      textDocument(["Alpha", "Hello world from the render diff", "Gamma"]),
      textDocument(["Alpha", "Hello brave world from the render diff", "Gamma"]),
    )

    const modified = rows.find((row) => row.status === "modified")
    expect(modified?.old?.index).toBe(1)
    expect(modified?.new?.index).toBe(1)
    expect(modified?.contentSimilarity).toBeGreaterThan(0.8)
    expect(rows.filter((row) => row.status === "added" || row.status === "removed")).toHaveLength(0)
  })

  it("does not pair a scene type replacement as a modification", () => {
    const rows = alignMarkdown(
      documentFor([textScene("Alpha"), textScene("Old text")]),
      documentFor([
        textScene("Alpha"),
        textScene("ignored", {
          typeBlock: "!image src:https://example.com/image.png alt:New image",
        }),
      ]),
    )

    expect(rows.filter((row) => row.status === "modified")).toHaveLength(0)
    expect(rows.filter((row) => row.status === "removed")).toHaveLength(1)
    expect(rows.filter((row) => row.status === "added")).toHaveLength(1)
  })

  it("classifies an exact-content duration change as retimed", () => {
    const rows = alignMarkdown(
      textDocument([{ text: "Alpha", duration: 2 }]),
      textDocument([{ text: "Alpha", duration: 4 }]),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe("retimed")
    expect(rows[0]?.durationDeltaSeconds).toBe(2)
    expect(rows[0]?.positionDeltaSeconds).toBe(0)
  })
})

describe("frame sampling", () => {
  it("uses fractional interior positions mapped independently into each version", () => {
    const rows = alignMarkdown(
      textDocument([{ text: "Alpha", duration: 2 }]),
      textDocument([{ text: "Alpha", duration: 4 }]),
    )
    const plan = createFrameSamplePlan(rows, 2)

    expect(plan.samples).toHaveLength(2)
    expect(plan.samples.map((sample) => sample.fraction)).toEqual([0.5, 0.8])
    expect(plan.oldTimes).toEqual([1, 1.6])
    expect(plan.newTimes).toEqual([2, 3.2])
  })

  it("samples only aligned scene pairs", () => {
    const rows = alignMarkdown(textDocument(["Alpha"]), textDocument(["Alpha", "Added"]))
    const plan = createFrameSamplePlan(rows, 3)

    expect(plan.samples).toHaveLength(3)
    expect(plan.samples.every((sample) => sample.rowIndex === 0)).toBe(true)
  })
})

describe("render change classification and unexpected semantics", () => {
  it("implements the documented magnitude boundaries", () => {
    expect(classifyRenderChange(0)).toBe("identical")
    expect(classifyRenderChange(0.0999)).toBe("identical")
    expect(classifyRenderChange(0.1)).toBe("minor")
    expect(classifyRenderChange(4.999)).toBe("minor")
    expect(classifyRenderChange(5)).toBe("moderate")
    expect(classifyRenderChange(24.999)).toBe("moderate")
    expect(classifyRenderChange(25)).toBe("heavy")
  })

  it("aggregates mean and max frame percentages", () => {
    expect(aggregateChangePercents([1, 3, 8])).toEqual({
      meanChangePercent: 4,
      maxFrameChangePercent: 8,
    })
  })

  it("flags unchanged scenes at the configured threshold but allows exact zeros", () => {
    const thresholds = {
      unchangedPercent: DEFAULT_UNCHANGED_THRESHOLD_PERCENT,
      modifiedOutlierPercent: DEFAULT_OUTLIER_THRESHOLD_PERCENT,
    }
    expect(
      unexpectedReasonsForScene({
        status: "unchanged-content",
        contentSimilarity: 1,
        maxFrameChangePercent: 0,
        thresholds,
      }),
    ).toEqual([])
    expect(
      unexpectedReasonsForScene({
        status: "retimed",
        contentSimilarity: 1,
        maxFrameChangePercent: 0.1,
        thresholds,
      })[0],
    ).toContain("unchanged scene content")
  })

  it("treats normal modified-scene differences as expected but catches high-similarity magnitude outliers", () => {
    const thresholds = {
      unchangedPercent: 0.1,
      modifiedOutlierPercent: 25,
    }
    expect(
      unexpectedReasonsForScene({
        status: "modified",
        contentSimilarity: 0.9,
        maxFrameChangePercent: 12,
        thresholds,
      }),
    ).toEqual([])
    expect(
      unexpectedReasonsForScene({
        status: "modified",
        contentSimilarity: 0.9,
        maxFrameChangePercent: 25,
        thresholds,
      })[0],
    ).toContain("small content edit")
    expect(
      unexpectedReasonsForScene({
        status: "modified",
        contentSimilarity: 0.4,
        maxFrameChangePercent: 80,
        thresholds,
      }),
    ).toEqual([])
  })
})
