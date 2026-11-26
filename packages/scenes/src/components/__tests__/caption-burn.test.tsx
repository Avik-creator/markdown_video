// @vitest-environment jsdom

/**
 * Caption burn-in overlay tests. The overlay is the single burn-in
 * implementation shared by every capture pipeline, so these pin:
 *
 * - cue visibility as a pure function of ABSOLUTE video time, including the
 *   half-open boundary convention (a frame exactly at a cue end shows the
 *   next cue or nothing — SRT end-time-exclusive semantics);
 * - per-line backing-box markup that depends only on invariant CSS features
 *   in both Chromium screenshots and the html2canvas capture clone;
 * - byte-identical SceneFrame markup with and without the captions prop when
 *   no cue is active — the DOM-level guarantee that burn-in is strictly
 *   opt-in and burn-off output is pixel-identical.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render } from "@testing-library/react";
import { parseMarkdown, type CaptionCue } from "@markdown-video/core";
import { CaptionBurnOverlay } from "../CaptionBurnOverlay.js";
import { SceneFrame } from "../../frame/SceneFrame.js";

const cues: CaptionCue[] = [
  { sceneIndex: 0, startTime: 0, endTime: 2, text: "Hello captions" },
  { sceneIndex: 1, startTime: 2, endTime: 4, text: "Second scene" },
];

function markup(props: { cues: readonly CaptionCue[]; time: number }) {
  return renderToStaticMarkup(createElement(CaptionBurnOverlay, props));
}

afterEach(cleanup);

describe("CaptionBurnOverlay timing", () => {
  it("renders the active cue text inside its half-open interval", () => {
    expect(markup({ cues, time: 0 })).toContain("Hello captions");
    expect(markup({ cues, time: 1.999 })).toContain("Hello captions");
    expect(markup({ cues, time: 2 })).toContain("Second scene");
    expect(markup({ cues, time: 2 })).not.toContain("Hello captions");
  });

  it("renders nothing at exact cue end with no following cue", () => {
    expect(markup({ cues, time: 4 })).toBe("");
    expect(markup({ cues, time: 4.5 })).toBe("");
  });

  it("renders nothing before the first cue or with empty cues", () => {
    const late = [{ sceneIndex: 0, startTime: 1, endTime: 2, text: "late" }];
    expect(markup({ cues: late, time: 0.5 })).toBe("");
    expect(markup({ cues: [], time: 1 })).toBe("");
  });

  it("honors staggered cue boundaries exactly", () => {
    const staggered: CaptionCue[] = [
      { sceneIndex: 0, startTime: 0.1, endTime: 0.6, text: "Line one" },
      { sceneIndex: 0, startTime: 0.6, endTime: 1.1, text: "Line two" },
    ];
    expect(markup({ cues: staggered, time: 0.05 })).toBe("");
    expect(markup({ cues: staggered, time: 0.6 })).toContain("Line two");
    expect(markup({ cues: staggered, time: 0.6 })).not.toContain("Line one");
  });
});

describe("CaptionBurnOverlay markup", () => {
  it("splits multi-line cues into one backing box per line", () => {
    const multi: CaptionCue[] = [
      { sceneIndex: 0, startTime: 0, endTime: 2, text: "First line\nSecond line" },
    ];
    const html = markup({ cues: multi, time: 1 });
    expect(html).toContain(">First line</div>");
    expect(html).toContain(">Second line</div>");
    // No reliance on white-space: pre-line in the capture clone: lines are
    // separate elements instead.
    expect(html).not.toContain("pre-line");
  });

  it("renders non-Latin text verbatim", () => {
    const unicode: CaptionCue[] = [
      { sceneIndex: 0, startTime: 0, endTime: 2, text: "Привет мир Γειά σου" },
    ];
    expect(markup({ cues: unicode, time: 1 })).toContain("Привет мир Γειά σου");
  });

  it("is deterministic: identical inputs produce identical markup", () => {
    expect(markup({ cues, time: 1.234 })).toBe(markup({ cues, time: 1.234 }));
  });

  it("carries the testable capture attribute and safe-margin positioning", () => {
    const html = markup({ cues, time: 1 });
    expect(html).toContain('data-caption-burn="true"');
    expect(html).toContain("pointer-events-none");
  });
});

describe("SceneFrame captions integration", () => {
  const scene = parseMarkdown(`!scene
!duration 4
!text
Hello captions
`)[0];

  function frameMarkup(captions?: { cues: readonly CaptionCue[]; time: number }) {
    return renderToStaticMarkup(
      createElement(SceneFrame, {
        scene,
        sceneTime: 1,
        aspectRatio: "16:9",
        ...(captions ? { captions } : {}),
      })
    );
  }

  it("renders the overlay inside the capture subtree when a cue is active", () => {
    const html = frameMarkup({ cues, time: 1 });
    expect(html).toContain('data-caption-burn="true"');
    expect(html).toContain("Hello captions");
  });

  it("is byte-identical without the captions prop and with no active cue", () => {
    const withoutProp = frameMarkup();
    const inactiveTime = frameMarkup({ cues, time: 4 });
    const emptyCues = frameMarkup({ cues: [], time: 1 });
    expect(inactiveTime).toBe(withoutProp);
    expect(emptyCues).toBe(withoutProp);
    expect(withoutProp).not.toContain("data-caption-burn");
  });

  it("renders into the live DOM inside data-scene-preview", () => {
    const { container } = render(
      createElement(SceneFrame, {
        scene,
        sceneTime: 1,
        aspectRatio: "16:9",
        captions: { cues, time: 1 },
      })
    );
    const preview = container.querySelector('[data-scene-preview="true"]');
    expect(preview?.querySelector('[data-caption-burn="true"]')?.textContent).toBe(
      "Hello captions"
    );
  });
});
