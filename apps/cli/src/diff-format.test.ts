import { describe, expect, it } from "vitest"

import { formatDiffReport } from "./diff-format.js"
import type { DiffReport } from "./diff-model.js"

function reportFixture(): DiffReport {
  return {
    version: 1,
    verdict: "fail",
    inputs: {
      old: { path: "old.md", sceneCount: 1, duration: 2 },
      new: { path: "new.md", sceneCount: 1, duration: 3 },
    },
    settings: {
      resolution: "480p",
      aspectRatio: "16:9",
      locale: null,
      samplesPerScene: 2,
      pixelmatchThreshold: 0.1,
      unchangedThresholdPercent: 0.1,
      modifiedOutlierPercent: 25,
      modifiedOutlierMinContentSimilarity: 0.9,
    },
    dimensions: { width: 854, height: 480 },
    summary: {
      alignedPairs: 1,
      unchangedContent: 0,
      modified: 0,
      added: 0,
      removed: 0,
      retimed: 1,
      comparedScenes: 1,
      comparedFramePairs: 2,
      capturedFrames: 4,
      comparisonImagesWritten: 2,
      unexpectedScenes: 1,
      maxMeanChangePercent: 0.5,
      elapsedSeconds: 1.25,
      oldRenderElapsedSeconds: 0.5,
      newRenderElapsedSeconds: 0.6,
    },
    scenes: [
      {
        status: "retimed",
        old: {
          index: 0,
          type: "text",
          startTime: 0,
          duration: 2,
          contentHash: "a".repeat(64),
        },
        new: {
          index: 0,
          type: "text",
          startTime: 0,
          duration: 3,
          contentHash: "a".repeat(64),
        },
        contentSimilarity: 1,
        timing: { positionDeltaSeconds: 0, durationDeltaSeconds: 1 },
        comparison: {
          classification: "minor",
          meanChangePercent: 0.5,
          maxFrameChangePercent: 0.75,
          samples: [
            {
              sampleIndex: 0,
              fraction: 0.5,
              oldTime: 1,
              newTime: 1.5,
              width: 854,
              height: 480,
              totalPixels: 409_920,
              mismatchedPixels: 2049,
              changePercent: 0.5,
              comparisonImagePath: null,
            },
          ],
        },
        unexpected: true,
        unexpectedReasons: ["unchanged scene content rendered 0.750% different"],
      },
    ],
  }
}

describe("diff JSON report schema", () => {
  it("round-trips the documented top-level, summary, scene, and sample keys", () => {
    const serialized = JSON.parse(JSON.stringify(reportFixture())) as DiffReport

    expect(Object.keys(serialized)).toEqual([
      "version",
      "verdict",
      "inputs",
      "settings",
      "dimensions",
      "summary",
      "scenes",
    ])
    expect(Object.keys(serialized.settings)).toEqual([
      "resolution",
      "aspectRatio",
      "locale",
      "samplesPerScene",
      "pixelmatchThreshold",
      "unchangedThresholdPercent",
      "modifiedOutlierPercent",
      "modifiedOutlierMinContentSimilarity",
    ])
    expect(Object.keys(serialized.summary)).toEqual([
      "alignedPairs",
      "unchangedContent",
      "modified",
      "added",
      "removed",
      "retimed",
      "comparedScenes",
      "comparedFramePairs",
      "capturedFrames",
      "comparisonImagesWritten",
      "unexpectedScenes",
      "maxMeanChangePercent",
      "elapsedSeconds",
      "oldRenderElapsedSeconds",
      "newRenderElapsedSeconds",
    ])
    expect(Object.keys(serialized.scenes[0]!)).toEqual([
      "status",
      "old",
      "new",
      "contentSimilarity",
      "timing",
      "comparison",
      "unexpected",
      "unexpectedReasons",
    ])
    expect(Object.keys(serialized.scenes[0]!.comparison!.samples[0]!)).toEqual([
      "sampleIndex",
      "fraction",
      "oldTime",
      "newTime",
      "width",
      "height",
      "totalPixels",
      "mismatchedPixels",
      "changePercent",
      "comparisonImagePath",
    ])
    expect(serialized.version).toBe(1)
    expect(serialized.verdict).toBe("fail")
  })
})

describe("formatDiffReport", () => {
  it("includes the per-scene table, verdict, unexpected rule, and cost accounting", () => {
    const output = formatDiffReport(reportFixture())

    expect(output).toContain("markdown-video visual diff: old.md -> new.md")
    expect(output).toContain("STATUS")
    expect(output).toContain("retimed")
    expect(output).toContain("0.500%")
    expect(output).toContain("UNEXPECTED: unchanged scene content")
    expect(output).toContain("Verdict: FAIL — 1 unexpected scene change")
    expect(output).toContain("unchanged/retimed scenes at >=0.100%")
    expect(output).toContain("2 frame pairs compared (4 captured frames)")
    expect(output.endsWith("\n")).toBe(true)
  })
})
