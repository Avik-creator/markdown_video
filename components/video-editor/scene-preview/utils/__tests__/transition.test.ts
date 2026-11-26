import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRANSITION_DURATION,
  normalizeTransitionDuration,
  transitionProgress,
} from "../transition";

describe("normalizeTransitionDuration", () => {
  it("uses the schema default when the duration is absent", () => {
    expect(normalizeTransitionDuration(undefined)).toBe(
      DEFAULT_TRANSITION_DURATION
    );
    expect(normalizeTransitionDuration(undefined)).toBe(0.5);
  });

  it("preserves valid positive durations", () => {
    expect(normalizeTransitionDuration(0.25)).toBe(0.25);
    expect(normalizeTransitionDuration(1)).toBe(1);
    expect(normalizeTransitionDuration(2.75)).toBe(2.75);
  });

  it("falls back to the default for zero, negative, non-finite, and non-numeric values", () => {
    for (const value of [0, -0.1, Number.NaN, Infinity, -Infinity, "1s", null]) {
      expect(normalizeTransitionDuration(value)).toBe(
        DEFAULT_TRANSITION_DURATION
      );
    }
  });
});

describe("transitionProgress", () => {
  it("interpolates from 0 to 1 over the configured duration", () => {
    expect(transitionProgress(0, 1)).toBe(0);
    expect(transitionProgress(0.25, 1)).toBeCloseTo(0.25);
    expect(transitionProgress(0.5, 1)).toBeCloseTo(0.5);
    expect(transitionProgress(1, 1)).toBe(1);
  });

  it("honors non-default durations", () => {
    expect(transitionProgress(0.5, 2)).toBeCloseTo(0.25);
    expect(transitionProgress(0.5, 0.25)).toBe(1);
  });

  it("clamps out-of-range scene times", () => {
    expect(transitionProgress(-0.5, 1)).toBe(0);
    expect(transitionProgress(3, 1)).toBe(1);
  });

  it("never produces NaN for invalid scene times or durations", () => {
    for (const duration of [0, -1, Number.NaN, Infinity, undefined]) {
      expect(transitionProgress(0.25, duration)).toBeCloseTo(0.5);
    }
    expect(transitionProgress(Number.NaN, 1)).toBe(0);
    expect(transitionProgress(Infinity, 1)).toBe(1);
  });
});
