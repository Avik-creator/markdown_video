import { describe, expect, it, vi, afterEach } from "vitest";
import { getVideoEncodingSettings } from "@markdown-video/core";
import {
  BACKGROUND_TAB_PAUSE_MESSAGE,
  chooseExportEncoder,
  computeEncodeProgressPercent,
  createFrameTimeEstimator,
  formatEta,
  getBackgroundTabPauseMessage,
  getBrowserVideoEncodingSettings,
  withTimeout,
} from "../export-utils";

describe("getBrowserVideoEncodingSettings", () => {
  it("shifts the preset scale faster for single-threaded wasm", () => {
    const expected: Record<string, string> = {
      fastest: "ultrafast",
      fast: "superfast",
      balanced: "veryfast",
      slow: "faster",
      slowest: "fast",
    };
    for (const [speed, preset] of Object.entries(expected)) {
      expect(getBrowserVideoEncodingSettings("high", speed).preset).toBe(preset);
    }
  });

  it("keeps the same CRF as the shared encoding table for every speed", () => {
    for (const quality of ["low", "medium", "high", "ultra"]) {
      for (const speed of ["fastest", "fast", "balanced", "slow", "slowest"]) {
        expect(getBrowserVideoEncodingSettings(quality, speed).crf).toBe(
          getVideoEncodingSettings(quality, speed).crf
        );
      }
    }
  });

  it("falls back to the balanced browser preset for unknown speeds", () => {
    expect(getBrowserVideoEncodingSettings("high", "ludicrous").preset).toBe(
      "veryfast"
    );
  });
});

describe("computeEncodeProgressPercent", () => {
  it("maps microseconds of output to a percent", () => {
    expect(computeEncodeProgressPercent(0, 30)).toBe(0);
    expect(computeEncodeProgressPercent(15_000_000, 30)).toBe(50);
    expect(computeEncodeProgressPercent(9_900_000, 33)).toBe(30);
  });

  it("clamps at 99 while running so completion alone can show 100", () => {
    expect(computeEncodeProgressPercent(60_000_000, 30)).toBe(99);
    expect(computeEncodeProgressPercent(30_000_000, 30)).toBe(99);
  });

  it("clamps negative time to 0", () => {
    expect(computeEncodeProgressPercent(-5_000_000, 30)).toBe(0);
  });

  it("returns 0 for a zero or invalid total duration", () => {
    expect(computeEncodeProgressPercent(5_000_000, 0)).toBe(0);
    expect(computeEncodeProgressPercent(5_000_000, -1)).toBe(0);
    expect(computeEncodeProgressPercent(5_000_000, Number.NaN)).toBe(0);
    expect(computeEncodeProgressPercent(Number.NaN, 30)).toBe(0);
  });
});

describe("formatEta", () => {
  it("formats sub-minute durations in seconds", () => {
    expect(formatEta(45_000)).toBe("45s");
    expect(formatEta(0)).toBe("0s");
    expect(formatEta(59_500)).toBe("1m");
  });

  it("formats minutes and seconds", () => {
    expect(formatEta(190_000)).toBe("3m 10s");
    expect(formatEta(60_000)).toBe("1m");
    expect(formatEta(3_599_000)).toBe("59m 59s");
  });

  it("formats hours", () => {
    expect(formatEta(3_660_000)).toBe("1h 1m");
  });

  it("returns an empty label for invalid input", () => {
    expect(formatEta(-1)).toBe("");
    expect(formatEta(Number.NaN)).toBe("");
  });
});

describe("createFrameTimeEstimator", () => {
  it("returns no estimate until enough frames have completed", () => {
    const estimator = createFrameTimeEstimator();
    for (let i = 0; i < 4; i++) estimator.addFrame(100);
    expect(estimator.estimateRemainingMs(10)).toBeNull();
    estimator.addFrame(100);
    expect(estimator.estimateRemainingMs(10)).toBe(1000);
  });

  it("uses a moving average over the recent window", () => {
    const estimator = createFrameTimeEstimator({ windowSize: 5, minSamples: 5 });
    for (let i = 0; i < 10; i++) estimator.addFrame(100);
    for (let i = 0; i < 5; i++) estimator.addFrame(200);
    expect(estimator.estimateRemainingMs(10)).toBe(2000);
  });

  it("returns null when no frames remain", () => {
    const estimator = createFrameTimeEstimator();
    for (let i = 0; i < 5; i++) estimator.addFrame(100);
    expect(estimator.estimateRemainingMs(0)).toBeNull();
  });
});

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the promise value before the deadline", async () => {
    vi.useFakeTimers();
    const result = withTimeout(
      Promise.resolve("done"),
      30_000,
      () => new Error("timeout")
    );
    await expect(result).resolves.toBe("done");
  });

  it("rejects with the watchdog error after the deadline", async () => {
    vi.useFakeTimers();
    const result = withTimeout(
      new Promise(() => {}),
      30_000,
      () => new Error("frame capture timed out")
    );
    const expectation = expect(result).rejects.toThrow(
      "frame capture timed out"
    );
    await vi.advanceTimersByTimeAsync(30_000);
    await expectation;
  });

  it("does not fire the watchdog after the promise already settled", async () => {
    vi.useFakeTimers();
    const result = withTimeout(
      Promise.resolve("fast"),
      30_000,
      () => new Error("timeout")
    );
    await expect(result).resolves.toBe("fast");
    await vi.advanceTimersByTimeAsync(60_000);
  });
});

describe("getBackgroundTabPauseMessage", () => {
  it("returns the pause message only when the tab is hidden", () => {
    expect(getBackgroundTabPauseMessage("hidden")).toBe(
      BACKGROUND_TAB_PAUSE_MESSAGE
    );
    expect(getBackgroundTabPauseMessage("visible")).toBeNull();
    expect(getBackgroundTabPauseMessage("prerender")).toBeNull();
  });
});

describe("chooseExportEncoder", () => {
  it("uses WebCodecs for MP4-family formats only when a config was selected", () => {
    const config = { codec: "avc1.640028" };
    expect(chooseExportEncoder({ format: "mp4", webCodecsConfig: config })).toBe("webcodecs");
    expect(chooseExportEncoder({ format: "reels", webCodecsConfig: config })).toBe("webcodecs");
    expect(chooseExportEncoder({ format: "shorts", webCodecsConfig: config })).toBe("webcodecs");
    expect(chooseExportEncoder({ format: undefined, webCodecsConfig: config })).toBe("webcodecs");
  });

  it("keeps GIF and config-less exports on the ffmpeg path", () => {
    const config = { codec: "avc1.640028" };
    expect(chooseExportEncoder({ format: "gif", webCodecsConfig: config })).toBe("ffmpeg");
    expect(chooseExportEncoder({ format: "mp4", webCodecsConfig: null })).toBe("ffmpeg");
    expect(chooseExportEncoder({ format: "mp4", webCodecsConfig: undefined })).toBe("ffmpeg");
  });
});
