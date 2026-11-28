import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RenderRunTracker,
  copyFrameData,
  createWarmResourceLifecycle,
  getExportArtifactNames,
} from "../export-utils";

describe("frame encoding helpers", () => {
  it("copies frame bytes before ffmpeg transfers the backing buffer", () => {
    const source = new Uint8Array([1, 2, 3, 255]);
    const copy = copyFrameData(source);

    expect(copy).toEqual(source);
    expect(copy.buffer).not.toBe(source.buffer);

    source[0] = 99;
    expect(copy[0]).toBe(1);
  });
});

describe("generation-scoped artifact names", () => {
  it("names frames, palettes, and outputs for one generation only", () => {
    expect(getExportArtifactNames(7, "gif")).toEqual({
      frameDirectory: "frames-7",
      paletteFileName: "palette-7.png",
      outputFileName: "output-7.gif",
      musicFileName: "music-7",
      webcodecsVideoFileName: "webcodecs-video-7.mp4",
      outputExtension: "gif",
    });
    expect(getExportArtifactNames(7, "reels")).toEqual({
      frameDirectory: "frames-7",
      paletteFileName: "palette-7.png",
      outputFileName: "output-7.mp4",
      musicFileName: "music-7",
      webcodecsVideoFileName: "webcodecs-video-7.mp4",
      outputExtension: "mp4",
    });
  });

  it("never reuses mutable output artifact names across generations", () => {
    const first = getExportArtifactNames(1, "mp4");
    const second = getExportArtifactNames(2, "mp4");

    expect(first.frameDirectory).not.toBe(second.frameDirectory);
    expect(first.paletteFileName).not.toBe(second.paletteFileName);
    expect(first.outputFileName).not.toBe(second.outputFileName);
    expect(first.musicFileName).not.toBe(second.musicFileName);
  });

  it("allocates no caption or font artifacts: burn-in is DOM-composited", () => {
    const names = Object.values(getExportArtifactNames(3, "mp4")).join(" ");
    expect(names).not.toContain("caption");
    expect(names).not.toContain("font");
    expect(names).not.toContain(".ttf");
  });
});

describe("createWarmResourceLifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reference-counts leases and reuses the warm resource across independent consumers", () => {
    vi.useFakeTimers();
    const created: string[] = [];
    const disposed: string[] = [];
    const lifecycle = createWarmResourceLifecycle({
      create: () => {
        const resource = `resource-${created.length + 1}`;
        created.push(resource);
        return resource;
      },
      dispose: (resource) => disposed.push(resource),
      idleTimeoutMs: 1000,
    });

    const first = lifecycle.acquire();
    const second = lifecycle.acquire();
    expect(second.resource).toBe(first.resource);
    expect(lifecycle.activeLeaseCount).toBe(2);

    first.release();
    vi.advanceTimersByTime(1000);
    expect(disposed).toEqual([]);

    second.release();
    vi.advanceTimersByTime(999);
    expect(disposed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(disposed).toEqual([first.resource]);
  });

  it("cancels idle disposal when the resource is reacquired in time", () => {
    vi.useFakeTimers();
    const created: string[] = [];
    const disposed: string[] = [];
    const lifecycle = createWarmResourceLifecycle({
      create: () => {
        const resource = `resource-${created.length + 1}`;
        created.push(resource);
        return resource;
      },
      dispose: (resource) => disposed.push(resource),
      idleTimeoutMs: 1000,
    });

    const first = lifecycle.acquire();
    first.release();
    vi.advanceTimersByTime(500);

    const second = lifecycle.acquire();
    vi.advanceTimersByTime(2000);
    expect(second.resource).toBe(first.resource);
    expect(disposed).toEqual([]);
    expect(created).toHaveLength(1);

    second.release();
    vi.advanceTimersByTime(1000);
    expect(disposed).toEqual([first.resource]);

    const third = lifecycle.acquire();
    expect(third.resource).not.toBe(first.resource);
    expect(created).toHaveLength(2);
    third.release();
  });

  it("ignores double release so one consumer cannot dispose another consumer's lease early", () => {
    vi.useFakeTimers();
    const disposed: string[] = [];
    const lifecycle = createWarmResourceLifecycle({
      create: () => "shared",
      dispose: (resource) => disposed.push(resource),
      idleTimeoutMs: 1000,
    });

    const first = lifecycle.acquire();
    const second = lifecycle.acquire();
    first.release();
    first.release();
    expect(lifecycle.activeLeaseCount).toBe(1);

    vi.advanceTimersByTime(5000);
    expect(disposed).toEqual([]);

    second.release();
    vi.advanceTimersByTime(1000);
    expect(disposed).toEqual(["shared"]);
  });
});

describe("RenderRunTracker", () => {
  it("does not reuse generation numbers across tracker instances", () => {
    const firstTracker = new RenderRunTracker();
    const secondTracker = new RenderRunTracker();

    const first = firstTracker.beginRun();
    const second = secondTracker.beginRun();

    expect(second).not.toBe(first);
  });

  it("invalidates older generations when a new run starts", () => {
    const tracker = new RenderRunTracker();
    const first = tracker.beginRun();
    const second = tracker.beginRun();

    expect(tracker.isCurrent(first)).toBe(false);
    expect(tracker.isCurrent(second)).toBe(true);
  });

  it("cancels only the requested current generation", () => {
    const tracker = new RenderRunTracker();
    const stale = tracker.beginRun();
    const current = tracker.beginRun();

    tracker.cancelRun(stale);
    expect(tracker.isCurrent(current)).toBe(true);

    tracker.cancelRun(current);
    expect(tracker.isCurrent(current)).toBe(false);
  });

  it("cancels the current generation when no generation is supplied", () => {
    const tracker = new RenderRunTracker();
    const current = tracker.beginRun();

    tracker.cancelRun();
    expect(tracker.isCurrent(current)).toBe(false);
  });
});
