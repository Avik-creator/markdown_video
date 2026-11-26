import { describe, expect, it } from "vitest";
import type { TimelineElement } from "@markdown-video/core";
import {
  TIMELINE_ELEMENT_ENTER_DURATION,
  TIMELINE_ELEMENT_EXIT_DURATION,
  timelineElementVisualState,
} from "../timeline-animation";

function element(overrides: Partial<TimelineElement>): TimelineElement {
  return {
    id: "element",
    type: "text",
    content: "Hello",
    at: 1,
    duration: 2,
    animation: "fadeIn",
    ...overrides,
  };
}

describe("timelineElementVisualState", () => {
  it("is hidden before the element and after its deterministic exit finishes", () => {
    const el = element({});
    expect(timelineElementVisualState(el, 0.99)).toBeNull();
    expect(
      timelineElementVisualState(el, 3 + TIMELINE_ELEMENT_EXIT_DURATION)
    ).toBeNull();
  });

  it("fades in over the entrance duration as a pure function of scene time", () => {
    const el = element({});
    const halfway = timelineElementVisualState(
      el,
      1 + TIMELINE_ELEMENT_ENTER_DURATION / 2
    );
    expect(halfway!.opacity).toBeCloseTo(0.5);
    expect(halfway).toMatchObject({ x: 0, y: 0, scale: 1 });

    const settled = timelineElementVisualState(el, 2.5);
    expect(settled).toMatchObject({ opacity: 1, x: 0, y: 0, scale: 1 });
  });

  it("keeps slide offsets deterministic during entrance", () => {
    const el = element({ animation: "slideUp" });
    expect(timelineElementVisualState(el, 1)).toMatchObject({
      opacity: 0,
      y: 20,
    });
    const halfway = timelineElementVisualState(
      el,
      1 + TIMELINE_ELEMENT_ENTER_DURATION / 2
    );
    expect(halfway!.opacity).toBeCloseTo(0.5);
    expect(halfway!.y).toBeCloseTo(10);
    expect(timelineElementVisualState(el, 2.5)).toMatchObject({
      opacity: 1,
      y: 0,
    });
  });

  it("runs the exit deterministically after the element duration ends", () => {
    const el = element({ animation: "slideUp" });
    const end = 3;
    const halfway = timelineElementVisualState(
      el,
      end + TIMELINE_ELEMENT_EXIT_DURATION / 2
    );

    expect(halfway).not.toBeNull();
    expect(halfway!.opacity).toBeCloseTo(0.5);
    expect(halfway!.y).toBeCloseTo(-25);
  });

  it("starts exit from the partially entered state for short elements", () => {
    const el = element({ at: 0, duration: 0.15, animation: "fadeIn" });
    // The entrance only reached 50% when the exit began.
    const halfway = timelineElementVisualState(
      el,
      0.15 + TIMELINE_ELEMENT_EXIT_DURATION / 2
    );
    expect(halfway!.opacity).toBeCloseTo(0.25);
  });

  it("uses animation-specific exit targets", () => {
    const zoom = element({ animation: "zoomIn" });
    const state = timelineElementVisualState(
      zoom,
      3 + TIMELINE_ELEMENT_EXIT_DURATION / 2
    );
    expect(state!.opacity).toBeCloseTo(0.5);
    expect(state!.scale).toBeCloseTo(1.1);
  });

  it("never emits NaN for invalid timing input", () => {
    const invalid = element({ at: Number.NaN, duration: 2 });
    expect(timelineElementVisualState(invalid, 1)).toBeNull();

    const zeroDuration = element({ duration: 0 });
    expect(timelineElementVisualState(zeroDuration, 1)).toBeNull();

    const el = element({});
    expect(timelineElementVisualState(el, Number.NaN)).toBeNull();
  });
});
