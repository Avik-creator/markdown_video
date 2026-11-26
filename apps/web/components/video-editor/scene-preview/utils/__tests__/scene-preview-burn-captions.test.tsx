// @vitest-environment jsdom

/**
 * Preview-shell caption burn-in wiring tests. Browser export captures the
 * live preview DOM, so these pin the exact visibility contract:
 *
 * - no overlay in normal editing/preview, even when the user's burn-captions
 *   export preference is on — the preference alone never composites;
 * - the overlay appears inside [data-scene-preview] exactly while an export
 *   capture publishes cues, driven by the store's absolute playback clock
 *   (the same clock the capture loop seeks), including half-open cue
 *   boundaries;
 * - the overlay disappears as soon as the capture run ends.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { act, cleanup, render } from "@testing-library/react";
import type { CaptionCue } from "@markdown-video/core";
import { ScenePreview } from "../../../scene-preview";
import { useVideoStore } from "@/lib/use-video-store";
import {
  beginExportCaptionBurn,
  endExportCaptionBurn,
} from "../../../export-modal/utils/export-burn-captions";

const originalMarkdown = useVideoStore.getState().markdown;

const MARKDOWN = `!scene
!duration 2
!text
First caption

---

!scene
!duration 2
!text
Second caption
`;

const cues: CaptionCue[] = [
  { sceneIndex: 0, startTime: 0, endTime: 2, text: "First caption" },
  { sceneIndex: 1, startTime: 2, endTime: 4, text: "Second caption" },
];

function captionOverlay(container: HTMLElement) {
  return container.querySelector('[data-scene-preview="true"] [data-caption-burn="true"]');
}

afterEach(() => {
  cleanup();
  endExportCaptionBurn(cues);
  useVideoStore.getState().setMarkdown(originalMarkdown, false);
  useVideoStore.getState().seekTo(0);
  useVideoStore.getState().setExportSettings({ burnCaptions: false });
});

describe("ScenePreview caption burn-in wiring", () => {
  it("never composites captions in normal editing, even with the preference on", () => {
    act(() => {
      useVideoStore.getState().setExportSettings({ burnCaptions: true });
      useVideoStore.getState().setMarkdown(MARKDOWN, false);
      useVideoStore.getState().seekTo(1);
    });
    const { container } = render(createElement(ScenePreview));

    expect(captionOverlay(container)).toBeNull();
  });

  it("composites the active cue inside the capture subtree while a capture runs", () => {
    act(() => {
      useVideoStore.getState().setMarkdown(MARKDOWN, false);
      useVideoStore.getState().seekTo(1);
    });
    const { container } = render(createElement(ScenePreview));
    expect(captionOverlay(container)).toBeNull();

    act(() => {
      beginExportCaptionBurn(cues);
    });
    expect(captionOverlay(container)?.textContent).toBe("First caption");

    act(() => {
      endExportCaptionBurn(cues);
    });
    expect(captionOverlay(container)).toBeNull();
  });

  it("follows the absolute store clock across half-open cue boundaries", () => {
    act(() => {
      useVideoStore.getState().setMarkdown(MARKDOWN, false);
      beginExportCaptionBurn(cues);
    });
    const { container } = render(createElement(ScenePreview));

    act(() => {
      useVideoStore.getState().seekTo(1.999);
    });
    expect(captionOverlay(container)?.textContent).toBe("First caption");

    // Exactly at the first cue's end the second cue owns the frame —
    // the same end-time-exclusive semantics as the SRT/VTT sidecars.
    act(() => {
      useVideoStore.getState().seekTo(2);
    });
    expect(captionOverlay(container)?.textContent).toBe("Second caption");

    // End of the final cue: no caption at all.
    act(() => {
      useVideoStore.getState().seekTo(4);
    });
    expect(captionOverlay(container)).toBeNull();
  });
});
