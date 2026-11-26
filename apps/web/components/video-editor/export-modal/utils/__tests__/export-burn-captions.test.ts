// @vitest-environment jsdom

/**
 * Export caption burn-in capture state tests. The module is the bridge that
 * makes burned captions exist in the preview DOM exactly while an export
 * capture runs and never otherwise — the property that keeps normal editing
 * and playback pixel-free of captions while html2canvas picks them up.
 */

import { describe, expect, it, vi } from "vitest";
import type { CaptionCue } from "@markdown-video/core";
import {
  beginExportCaptionBurn,
  endExportCaptionBurn,
  getExportCaptionBurnCues,
  getExportCaptionBurnCuesServerSnapshot,
  subscribeExportCaptionBurn,
} from "../export-burn-captions";

const cues: CaptionCue[] = [
  { sceneIndex: 0, startTime: 0, endTime: 2, text: "Hello captions" },
];

describe("export caption burn capture state", () => {
  it("is inactive by default so normal editing never composites captions", () => {
    endExportCaptionBurn(cues);
    expect(getExportCaptionBurnCues()).toBeNull();
    expect(getExportCaptionBurnCuesServerSnapshot()).toBeNull();
  });

  it("publishes cues while a capture runs and clears them at run end", () => {
    beginExportCaptionBurn(cues);
    expect(getExportCaptionBurnCues()).toBe(cues);
    endExportCaptionBurn(cues);
    expect(getExportCaptionBurnCues()).toBeNull();
  });

  it("notifies subscribers exactly on begin/end transitions", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeExportCaptionBurn(listener);

    beginExportCaptionBurn(cues);
    endExportCaptionBurn(cues);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    beginExportCaptionBurn(cues);
    endExportCaptionBurn(cues);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("reference-matches cleanup so a cancelled run cannot clear a newer run", () => {
    const olderCues: CaptionCue[] = [
      { sceneIndex: 0, startTime: 0, endTime: 1, text: "older run" },
    ];
    const newerCues: CaptionCue[] = [
      { sceneIndex: 0, startTime: 0, endTime: 1, text: "newer run" },
    ];

    beginExportCaptionBurn(olderCues);
    // Simulate the old run ending after a new one already started: the old
    // run's delayed finally must not unpublish the new run's cues.
    beginExportCaptionBurn(newerCues);
    endExportCaptionBurn(olderCues);
    expect(getExportCaptionBurnCues()).toBe(newerCues);

    endExportCaptionBurn(newerCues);
    expect(getExportCaptionBurnCues()).toBeNull();
  });
});
