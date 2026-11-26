import { describe, it, expect } from "vitest";
import {
  timeAtPosition,
  positionPercentForTime,
  timeMarkerStep,
  buildTimeMarkers,
  exceedsDragThreshold,
  indexPermutation,
  adjacentReorder,
  reorderScenesInMarkdown,
} from "../timeline-utils";
import { parseMarkdown } from "@markdown-video/core";
import { DEFAULT_MARKDOWN } from "@/lib/default-markdown";

describe("timeAtPosition", () => {
  it("maps the midpoint to half the duration", () => {
    expect(timeAtPosition(50, 100, 10)).toBe(5);
  });

  it("maps the start to 0 and the end to totalDuration", () => {
    expect(timeAtPosition(0, 100, 10)).toBe(0);
    expect(timeAtPosition(100, 100, 10)).toBe(10);
  });

  it("clamps positions before the start", () => {
    expect(timeAtPosition(-20, 100, 10)).toBe(0);
  });

  it("clamps positions past the end", () => {
    expect(timeAtPosition(250, 100, 10)).toBe(10);
  });

  it("returns 0 when width is zero or negative", () => {
    expect(timeAtPosition(10, 0, 10)).toBe(0);
    expect(timeAtPosition(10, -5, 10)).toBe(0);
  });

  it("returns 0 when duration is zero or negative", () => {
    expect(timeAtPosition(10, 100, 0)).toBe(0);
    expect(timeAtPosition(10, 100, -3)).toBe(0);
  });

  it("supports fractional precision", () => {
    expect(timeAtPosition(33.3, 100, 9)).toBeCloseTo(2.997, 3);
  });
});

describe("positionPercentForTime", () => {
  it("maps half time to 50%", () => {
    expect(positionPercentForTime(5, 10)).toBe(50);
  });

  it("returns 0 for zero or negative duration", () => {
    expect(positionPercentForTime(5, 0)).toBe(0);
    expect(positionPercentForTime(5, -2)).toBe(0);
  });

  it("clamps to [0, 100]", () => {
    expect(positionPercentForTime(-1, 10)).toBe(0);
    expect(positionPercentForTime(11, 10)).toBe(100);
  });
});

describe("timeMarkerStep", () => {
  it("uses 10s steps for timelines over 60s", () => {
    expect(timeMarkerStep(61)).toBe(10);
    expect(timeMarkerStep(120)).toBe(10);
  });

  it("uses 5s steps for timelines over 30s up to 60s", () => {
    expect(timeMarkerStep(31)).toBe(5);
    expect(timeMarkerStep(60)).toBe(5);
  });

  it("uses 3s steps for timelines over 15s up to 30s", () => {
    expect(timeMarkerStep(16)).toBe(3);
    expect(timeMarkerStep(30)).toBe(3);
  });

  it("uses 1s steps otherwise", () => {
    expect(timeMarkerStep(15)).toBe(1);
    expect(timeMarkerStep(1)).toBe(1);
    expect(timeMarkerStep(0)).toBe(1);
  });
});

describe("buildTimeMarkers", () => {
  it("returns no markers for zero or negative durations", () => {
    expect(buildTimeMarkers(0)).toEqual([]);
    expect(buildTimeMarkers(-5)).toEqual([]);
  });

  it("marks every second for short timelines", () => {
    expect(buildTimeMarkers(4)).toEqual([0, 1, 2, 3, 4]);
  });

  it("excludes times past the total duration", () => {
    expect(buildTimeMarkers(4.5)).toEqual([0, 1, 2, 3, 4]);
  });

  it("uses the step for medium timelines", () => {
    expect(buildTimeMarkers(20)).toEqual([0, 3, 6, 9, 12, 15, 18]);
  });

  it("uses 10s steps for long timelines", () => {
    expect(buildTimeMarkers(65)).toEqual([0, 10, 20, 30, 40, 50, 60]);
  });
});

describe("exceedsDragThreshold", () => {
  it("is false for small movements", () => {
    expect(exceedsDragThreshold(0, 0)).toBe(false);
    expect(exceedsDragThreshold(2, 2)).toBe(false);
  });

  it("is true once the combined distance passes 3px", () => {
    expect(exceedsDragThreshold(3, 2)).toBe(true);
    expect(exceedsDragThreshold(0, 4)).toBe(true);
  });

  it("handles negative deltas", () => {
    expect(exceedsDragThreshold(-4, 0)).toBe(true);
    expect(exceedsDragThreshold(-1, -1)).toBe(false);
  });

  it("supports custom thresholds", () => {
    expect(exceedsDragThreshold(5, 0, 10)).toBe(false);
    expect(exceedsDragThreshold(11, 0, 10)).toBe(true);
  });
});

describe("indexPermutation", () => {
  it("returns the identity for unchanged order", () => {
    expect(indexPermutation(["a", "b", "c"], ["a", "b", "c"])).toEqual([0, 1, 2]);
  });

  it("maps each new position to the original index", () => {
    expect(indexPermutation(["a", "b", "c"], ["c", "a", "b"])).toEqual([2, 0, 1]);
  });

  it("handles reversal", () => {
    expect(indexPermutation(["a", "b", "c"], ["c", "b", "a"])).toEqual([2, 1, 0]);
  });

  it("returns null for length mismatch", () => {
    expect(indexPermutation(["a", "b"], ["a"])).toBeNull();
  });

  it("returns null for unknown ids", () => {
    expect(indexPermutation(["a", "b"], ["a", "x"])).toBeNull();
  });

  it("returns null for duplicates", () => {
    expect(indexPermutation(["a", "b"], ["a", "a"])).toBeNull();
  });
});

describe("adjacentReorder", () => {
  it("moves an item one position earlier", () => {
    expect(adjacentReorder(4, 2, "left")).toEqual({
      order: [0, 2, 1, 3],
      targetIndex: 1,
    });
  });

  it("moves an item one position later", () => {
    expect(adjacentReorder(4, 1, "right")).toEqual({
      order: [0, 2, 1, 3],
      targetIndex: 2,
    });
  });

  it("moves the first item right and the last item left", () => {
    expect(adjacentReorder(3, 0, "right")).toEqual({
      order: [1, 0, 2],
      targetIndex: 1,
    });
    expect(adjacentReorder(3, 2, "left")).toEqual({
      order: [0, 2, 1],
      targetIndex: 1,
    });
  });

  it("returns null at either end when no move is possible", () => {
    expect(adjacentReorder(3, 0, "left")).toBeNull();
    expect(adjacentReorder(3, 2, "right")).toBeNull();
    expect(adjacentReorder(1, 0, "left")).toBeNull();
    expect(adjacentReorder(1, 0, "right")).toBeNull();
  });

  it("returns null for invalid indexes and lengths", () => {
    expect(adjacentReorder(0, 0, "right")).toBeNull();
    expect(adjacentReorder(-1, 0, "right")).toBeNull();
    expect(adjacentReorder(3, -1, "right")).toBeNull();
    expect(adjacentReorder(3, 3, "left")).toBeNull();
    expect(adjacentReorder(3, 1.5, "right")).toBeNull();
  });
});

const SAMPLE = [
  "!var brand red", // 1
  "", // 2
  "!scene", // 3
  "!text", // 4
  "Alpha", // 5
  "", // 6
  "---", // 7
  "", // 8
  "!scene", // 9
  "!text", // 10
  "Beta", // 11
  "", // 12
  "---", // 13
  "", // 14
  "!scene", // 15
  "!text", // 16
  "Gamma", // 17
].join("\n");

const SAMPLE_RANGES = [
  { startLine: 3, endLine: 6 },
  { startLine: 9, endLine: 12 },
  { startLine: 15, endLine: 17 },
];

describe("reorderScenesInMarkdown", () => {
  it("returns the identical document for the identity order", () => {
    expect(reorderScenesInMarkdown(SAMPLE, SAMPLE_RANGES, [0, 1, 2])).toBe(SAMPLE);
  });

  it("moves the last scene to the front, keeping separators in place", () => {
    const result = reorderScenesInMarkdown(SAMPLE, SAMPLE_RANGES, [2, 0, 1]);
    expect(result).toBe(
      [
        "!var brand red",
        "",
        "!scene",
        "!text",
        "Gamma",
        "---",
        "",
        "!scene",
        "!text",
        "Alpha",
        "",
        "---",
        "",
        "!scene",
        "!text",
        "Beta",
        "",
      ].join("\n"),
    );
  });

  it("keeps the preamble before the first scene fixed", () => {
    const result = reorderScenesInMarkdown(SAMPLE, SAMPLE_RANGES, [1, 0, 2]);
    expect(result).not.toBeNull();
    const lines = result!.split("\n");
    expect(lines[0]).toBe("!var brand red");
    expect(lines[1]).toBe("");
  });

  it("swaps two adjacent scenes", () => {
    const result = reorderScenesInMarkdown(SAMPLE, SAMPLE_RANGES, [1, 0, 2]);
    expect(result).toBe(
      [
        "!var brand red",
        "",
        "!scene",
        "!text",
        "Beta",
        "",
        "---",
        "",
        "!scene",
        "!text",
        "Alpha",
        "",
        "---",
        "",
        "!scene",
        "!text",
        "Gamma",
      ].join("\n"),
    );
  });

  it("keeps trailing content after the last scene at the end", () => {
    const md = SAMPLE + "\n\n!export mp4";
    const ranges = [
      { startLine: 3, endLine: 6 },
      { startLine: 9, endLine: 12 },
      { startLine: 15, endLine: 17 },
    ];
    const result = reorderScenesInMarkdown(md, ranges, [1, 0, 2]);
    expect(result).not.toBeNull();
    expect(result!.endsWith("\n\n!export mp4")).toBe(true);
  });

  it("handles back-to-back scenes without separators", () => {
    const md = ["!scene", "!text", "One", "!scene", "!text", "Two"].join("\n");
    const ranges = [
      { startLine: 1, endLine: 3 },
      { startLine: 4, endLine: 6 },
    ];
    const result = reorderScenesInMarkdown(md, ranges, [1, 0]);
    expect(result).toBe(["!scene", "!text", "Two", "!scene", "!text", "One"].join("\n"));
  });

  it("preserves CRLF content verbatim", () => {
    const md = "!scene\r\n!text\r\nOne\r\n---\r\n!scene\r\n!text\r\nTwo";
    const ranges = [
      { startLine: 1, endLine: 3 },
      { startLine: 5, endLine: 7 },
    ];
    const result = reorderScenesInMarkdown(md, ranges, [1, 0]);
    expect(result).toBe("!scene\r\n!text\r\nTwo\n---\r\n!scene\r\n!text\r\nOne\r");
  });

  it("returns null when order is not a permutation", () => {
    expect(reorderScenesInMarkdown(SAMPLE, SAMPLE_RANGES, [0, 0, 1])).toBeNull();
    expect(reorderScenesInMarkdown(SAMPLE, SAMPLE_RANGES, [0, 1])).toBeNull();
    expect(reorderScenesInMarkdown(SAMPLE, SAMPLE_RANGES, [0, 1, 3])).toBeNull();
  });

  it("returns null for out-of-bounds ranges", () => {
    expect(
      reorderScenesInMarkdown(SAMPLE, [{ startLine: 0, endLine: 6 }], [0]),
    ).toBeNull();
    expect(
      reorderScenesInMarkdown(SAMPLE, [{ startLine: 3, endLine: 999 }], [0]),
    ).toBeNull();
    expect(
      reorderScenesInMarkdown(SAMPLE, [{ startLine: 5, endLine: 3 }], [0]),
    ).toBeNull();
  });

  it("returns null for overlapping or unsorted ranges", () => {
    expect(
      reorderScenesInMarkdown(
        SAMPLE,
        [
          { startLine: 3, endLine: 10 },
          { startLine: 9, endLine: 12 },
          { startLine: 15, endLine: 17 },
        ],
        [0, 1, 2],
      ),
    ).toBeNull();
    expect(
      reorderScenesInMarkdown(
        SAMPLE,
        [
          { startLine: 9, endLine: 12 },
          { startLine: 3, endLine: 6 },
          { startLine: 15, endLine: 17 },
        ],
        [0, 1, 2],
      ),
    ).toBeNull();
  });

  it("returns null when a range does not start on a scene directive line", () => {
    expect(
      reorderScenesInMarkdown(
        SAMPLE,
        [
          { startLine: 4, endLine: 6 }, // line 4 is "!text" — not a scene start
          { startLine: 9, endLine: 12 },
          { startLine: 15, endLine: 17 },
        ],
        [0, 1, 2],
      ),
    ).toBeNull();
    expect(
      reorderScenesInMarkdown(
        SAMPLE,
        [
          { startLine: 5, endLine: 6 }, // "Alpha" — not a directive at all
          { startLine: 9, endLine: 12 },
          { startLine: 15, endLine: 17 },
        ],
        [0, 1, 2],
      ),
    ).toBeNull();
  });

  it("accepts scene directive aliases", () => {
    const md = ["!slide", "!text", "One", "!frame", "!text", "Two"].join("\n");
    const ranges = [
      { startLine: 1, endLine: 3 },
      { startLine: 4, endLine: 6 },
    ];
    expect(reorderScenesInMarkdown(md, ranges, [1, 0])).toBe(
      ["!frame", "!text", "Two", "!slide", "!text", "One"].join("\n"),
    );
  });

  it("returns null for empty input", () => {
    expect(reorderScenesInMarkdown(SAMPLE, [], [])).toBeNull();
  });

  it("round-trips through the parser: reordered markdown parses scenes in the new order", () => {
    const md = [
      "!scene",
      "!text",
      "Alpha",
      "!duration 2s",
      "",
      "---",
      "",
      "!scene",
      "!text",
      "Beta",
      "!duration 2s",
      "",
      "---",
      "",
      "!scene",
      "!text",
      "Gamma",
      "!duration 2s",
    ].join("\n");

    const scenes = parseMarkdown(md);
    expect(scenes).toHaveLength(3);
    const ranges = scenes.map((s) => s.sourceMap!.scene!);

    const reordered = reorderScenesInMarkdown(md, ranges, [2, 0, 1]);
    expect(reordered).not.toBeNull();

    const reparsed = parseMarkdown(reordered!);
    expect(reparsed).toHaveLength(3);
    expect(reparsed.map((s) => s.text?.content)).toEqual(["Gamma", "Alpha", "Beta"]);
    // Durations and therefore total length are preserved
    expect(reparsed.every((s) => s.duration === 2)).toBe(true);
  });

  it("round-trips the default document: reversing scenes preserves types, durations and chapters", () => {
    const scenes = parseMarkdown(DEFAULT_MARKDOWN);
    expect(scenes.length).toBeGreaterThan(2);
    const ranges = scenes.map((s) => s.sourceMap!.scene!);
    const reversed = scenes.map((_, i) => scenes.length - 1 - i);

    const reordered = reorderScenesInMarkdown(DEFAULT_MARKDOWN, ranges, reversed);
    expect(reordered).not.toBeNull();

    const reparsed = parseMarkdown(reordered!);
    expect(reparsed).toHaveLength(scenes.length);
    expect(reparsed.map((s) => s.type)).toEqual(
      scenes.map((s) => s.type).reverse(),
    );
    expect(reparsed.map((s) => s.duration)).toEqual(
      scenes.map((s) => s.duration).reverse(),
    );
    // Chapters travel with their scenes
    expect(reparsed.map((s) => s.chapter)).toEqual(
      scenes.map((s) => s.chapter).reverse(),
    );
    // The variable preamble stays at the top of the document
    expect(reordered!.split("\n")[0]).toBe("!var brandColor #3b82f6");
  });

  it("keeps scene ids stable-per-parse and produces valid ranges for the default document", () => {
    // Guards the assumptions commitReorder relies on: every scene has a
    // sourceMap.scene range, ranges are ascending and start on scene directives.
    const scenes = parseMarkdown(DEFAULT_MARKDOWN);
    const lines = DEFAULT_MARKDOWN.split("\n");
    let previousEnd = 0;
    for (const scene of scenes) {
      const range = scene.sourceMap?.scene;
      expect(range).toBeDefined();
      expect(range!.startLine).toBeGreaterThan(previousEnd);
      expect(lines[range!.startLine - 1].trim()).toMatch(/^!/);
      previousEnd = range!.endLine;
    }
  });
});
