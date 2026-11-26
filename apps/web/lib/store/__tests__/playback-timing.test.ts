import { describe, expect, it } from "vitest";
import "./memory-storage";
import {
  advancePlaybackTime,
  getFrameDuration,
} from "../../use-video-store";

describe("getFrameDuration", () => {
  it("defaults to 1/30s when no frame rate is available", () => {
    expect(getFrameDuration(undefined)).toBeCloseTo(1 / 30);
  });

  it("uses the project's frame rate when present", () => {
    expect(getFrameDuration(60)).toBeCloseTo(1 / 60);
    expect(getFrameDuration(24)).toBeCloseTo(1 / 24);
    expect(getFrameDuration(30)).toBeCloseTo(1 / 30);
  });

  it.each([0, -24, Number.NaN, Number.POSITIVE_INFINITY])(
    "falls back to 30fps for invalid frame rate %s",
    (fps) => {
      expect(getFrameDuration(fps)).toBeCloseTo(1 / 30);
    },
  );
});

describe("advancePlaybackTime", () => {
  it("advances by the elapsed wall-clock delta", () => {
    const result = advancePlaybackTime(1, 0.5, 1, 10);
    expect(result.time).toBeCloseTo(1.5);
    expect(result.reachedEnd).toBe(false);
  });

  it("scales the delta by playback speed", () => {
    expect(advancePlaybackTime(1, 0.5, 2, 10).time).toBeCloseTo(2);
    expect(advancePlaybackTime(1, 1, 0.5, 10).time).toBeCloseTo(1.5);
  });

  it("accumulates real elapsed time without per-tick rounding drift", () => {
    // 90 frames of a 60fps display at speed 1 must equal 1.5s of playback.
    // The old implementation added a fixed 0.033s per 33ms tick regardless
    // of how much time actually passed.
    let time = 0;
    for (let i = 0; i < 90; i++) {
      time = advancePlaybackTime(time, 1 / 60, 1, 100).time;
    }
    expect(time).toBeCloseTo(1.5, 10);
  });

  it("reflects irregular frame timing instead of assuming a fixed step", () => {
    // A slow frame (100ms) must advance playback by 100ms worth of time.
    expect(advancePlaybackTime(2, 0.1, 1, 10).time).toBeCloseTo(2.1);
    // A fast frame (8ms, 120hz display) advances proportionally less.
    expect(advancePlaybackTime(2, 0.008, 1, 10).time).toBeCloseTo(2.008);
  });

  it("clamps to totalDuration and reports the end when crossing it", () => {
    const result = advancePlaybackTime(9.5, 1, 1, 10);
    expect(result.time).toBe(10);
    expect(result.reachedEnd).toBe(true);
  });

  it("treats landing exactly on totalDuration as the end", () => {
    expect(advancePlaybackTime(9, 1, 1, 10).reachedEnd).toBe(true);
  });

  it("never returns a negative time", () => {
    const result = advancePlaybackTime(0.5, -5, 1, 10);
    expect(result.time).toBe(0);
    expect(result.reachedEnd).toBe(false);
  });

  it("keeps time unchanged for a zero delta", () => {
    const result = advancePlaybackTime(3, 0, 1, 10);
    expect(result.time).toBe(3);
    expect(result.reachedEnd).toBe(false);
  });
});
