import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FIXED_RENDER_LAYOUT_WIDTH,
  RenderRunTracker,
  copyFrameData,
  createRenderPlan,
  createWarmResourceLifecycle,
  getExportArtifactNames,
  getExportAspectRatio,
  getExportDimensions,
  getFrameEncoding,
  getFrameFileName,
  getRenderLayoutDimensions,
  getTotalFrameCount,
  normalizeOutputFps,
  validateExportInput,
} from "../export-utils";

describe("getExportDimensions", () => {
  it("treats the preset as the short side", () => {
    expect(getExportDimensions("1080p", "16:9")).toEqual({ width: 1920, height: 1080 });
    expect(getExportDimensions("1080p", "9:16")).toEqual({ width: 1080, height: 1920 });
    expect(getExportDimensions("1080p", "1:1")).toEqual({ width: 1080, height: 1080 });
    expect(getExportDimensions("1080p", "4:3")).toEqual({ width: 1440, height: 1080 });
  });

  it("covers every resolution preset", () => {
    expect(getExportDimensions("480p")).toEqual({ width: 854, height: 480 });
    expect(getExportDimensions("720p")).toEqual({ width: 1280, height: 720 });
    expect(getExportDimensions("1440p")).toEqual({ width: 2560, height: 1440 });
    expect(getExportDimensions("4k")).toEqual({ width: 3840, height: 2160 });
  });

  it("always returns even dimensions, which libx264 requires", () => {
    for (const res of ["480p", "720p", "1080p", "1440p", "4k"]) {
      for (const aspect of ["16:9", "9:16", "1:1", "4:3"]) {
        const { width, height } = getExportDimensions(res, aspect);
        expect(width % 2, `${res} ${aspect}`).toBe(0);
        expect(height % 2, `${res} ${aspect}`).toBe(0);
      }
    }
  });

  it("falls back to 1080p 16:9 for unknown input", () => {
    expect(getExportDimensions("8k", "21:9")).toEqual({ width: 1920, height: 1080 });
  });
});

describe("getExportAspectRatio", () => {
  it("forces reel and short exports to vertical video", () => {
    expect(getExportAspectRatio("reels", "16:9")).toBe("9:16");
    expect(getExportAspectRatio("shorts", "4:3")).toBe("9:16");
  });

  it("preserves the project aspect ratio for default landscape formats", () => {
    for (const format of ["mp4", "gif", "slides", undefined]) {
      expect(getExportAspectRatio(format, "16:9")).toBe("16:9");
      expect(getExportAspectRatio(format, "9:16")).toBe("9:16");
      expect(getExportAspectRatio(format, "1:1")).toBe("1:1");
      expect(getExportAspectRatio(format, "4:3")).toBe("4:3");
    }
  });
});

describe("getRenderLayoutDimensions", () => {
  it("uses canonical 1080p logical dimensions for each aspect ratio", () => {
    expect(getRenderLayoutDimensions("16:9")).toEqual({ width: 1920, height: 1080 });
    expect(getRenderLayoutDimensions("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(getRenderLayoutDimensions("1:1")).toEqual({ width: 1080, height: 1080 });
    expect(getRenderLayoutDimensions("4:3")).toEqual({ width: 1440, height: 1080 });
  });

  it("gives portrait exports a portrait logical width instead of a landscape composition width", () => {
    const portrait = getRenderLayoutDimensions("9:16");

    expect(portrait.width).toBeLessThan(portrait.height);
    expect(portrait.width).toBe(1080);
  });
});

describe("createRenderPlan", () => {
  it("uses a fixed 1920px-wide layout for landscape output", () => {
    expect(createRenderPlan({ resolution: "1080p", projectAspectRatio: "16:9", format: "mp4" })).toMatchObject({
      width: 1920,
      height: 1080,
      aspectRatio: "16:9",
      layoutWidth: FIXED_RENDER_LAYOUT_WIDTH,
      layoutHeight: 1080,
      captureScale: 1,
      logicalFontSizePx: 16,
      frameExtension: "jpg",
      inputPattern: "frame%05d.jpg",
    });
  });

  it("composes reels in a vertical logical layout even when the project is landscape", () => {
    const plan = createRenderPlan({ resolution: "1080p", projectAspectRatio: "16:9", format: "reels" });

    expect(plan.aspectRatio).toBe("9:16");
    expect(plan.width).toBe(1080);
    expect(plan.height).toBe(1920);
    expect(plan.layoutWidth).toBe(1080);
    expect(plan.layoutHeight).toBe(1920);
    expect(plan.captureScale).toBe(1);
  });

  it("keeps the same vertical logical layout across output resolutions", () => {
    const hd = createRenderPlan({ resolution: "1080p", projectAspectRatio: "16:9", format: "shorts" });
    const sd = createRenderPlan({ resolution: "720p", projectAspectRatio: "16:9", format: "shorts" });

    expect(sd.width).toBe(720);
    expect(sd.height).toBe(1280);
    expect(sd.layoutWidth).toBe(hd.layoutWidth);
    expect(sd.layoutHeight).toBeCloseTo(hd.layoutHeight, 6);
    expect(sd.captureScale).not.toBe(hd.captureScale);
  });

  it("keeps caption text in resolution-independent logical coordinates", () => {
    const captionLogicalPx = 36;
    const hd = createRenderPlan({ resolution: "1080p", projectAspectRatio: "16:9", format: "reels" });
    const sd = createRenderPlan({ resolution: "720p", projectAspectRatio: "16:9", format: "reels" });

    expect(hd.logicalFontSizePx).toBe(16);
    expect(sd.logicalFontSizePx).toBe(hd.logicalFontSizePx);

    // The physical raster size changes with the output scale, but the fraction
    // of the video frame occupied by the caption is invariant. Composition and
    // legibility therefore belong to the logical layout, not to the selected
    // output resolution.
    const hdFrameFraction = (captionLogicalPx * hd.captureScale) / hd.width;
    const sdFrameFraction = (captionLogicalPx * sd.captureScale) / sd.width;
    expect(sdFrameFraction).toBeCloseTo(hdFrameFraction, 8);
    expect(captionLogicalPx / hd.layoutWidth).toBeCloseTo(hdFrameFraction, 8);
  });

  it("maps the logical layout exactly onto the output size", () => {
    for (const resolution of ["480p", "720p", "1080p", "1440p", "4k"]) {
      for (const format of ["mp4", "reels", "shorts", "gif"]) {
        for (const projectAspectRatio of ["16:9", "9:16", "1:1", "4:3"]) {
          const plan = createRenderPlan({ resolution, projectAspectRatio, format });
          expect(plan.layoutWidth * plan.captureScale).toBeCloseTo(plan.width, 5);
          expect(plan.layoutHeight * plan.captureScale).toBeCloseTo(plan.height, 5);
          expect(plan.width % 2).toBe(0);
          expect(plan.height % 2).toBe(0);
        }
      }
    }
  });
});

describe("frame encoding helpers", () => {
  it("uses JPEG frames with quality-appropriate compression", () => {
    expect(getFrameEncoding("low")).toEqual({ extension: "jpg", mimeType: "image/jpeg", quality: 0.88 });
    expect(getFrameEncoding("medium")).toEqual({ extension: "jpg", mimeType: "image/jpeg", quality: 0.92 });
    expect(getFrameEncoding("high")).toEqual({ extension: "jpg", mimeType: "image/jpeg", quality: 0.95 });
    expect(getFrameEncoding("ultra")).toEqual({ extension: "jpg", mimeType: "image/jpeg", quality: 0.97 });
  });

  it("pads frame sequence file names", () => {
    expect(getFrameFileName(0, "jpg")).toBe("frame00000.jpg");
    expect(getFrameFileName(42, "jpg")).toBe("frame00042.jpg");
  });

  it("copies frame bytes before ffmpeg transfers the backing buffer", () => {
    const source = new Uint8Array([1, 2, 3, 255]);
    const copy = copyFrameData(source);

    expect(copy).toEqual(source);
    expect(copy.buffer).not.toBe(source.buffer);

    source[0] = 99;
    expect(copy[0]).toBe(1);
  });
});

describe("export input validation", () => {
  it("normalizes output fps using the same rules as the renderer", () => {
    expect(normalizeOutputFps(undefined)).toBe(30);
    expect(normalizeOutputFps(0)).toBe(30);
    expect(normalizeOutputFps(7.6)).toBe(8);
    expect(normalizeOutputFps(0.2)).toBe(1);
    expect(normalizeOutputFps(90)).toBe(60);
    expect(normalizeOutputFps(Number.NaN)).toBe(30);
  });

  it("computes a positive frame count for valid input", () => {
    expect(getTotalFrameCount(2, 30)).toBe(60);
    expect(getTotalFrameCount(0.01, 30)).toBe(1);

    const validation = validateExportInput({ sceneCount: 1, totalDuration: 2, fps: 30 });
    expect(validation).toEqual({
      valid: true,
      reason: null,
      outputFps: 30,
      totalFrameCount: 60,
    });
  });

  it("does not overshoot by one frame when floating point inflates an integral frame count", () => {
    // 8.3 * 30 is exactly 249 frames mathematically, but IEEE-754 multiplication
    // produces 249.00000000000003; a naive Math.ceil would render a 250th frame.
    expect(8.3 * 30).toBeGreaterThan(249);
    expect(getTotalFrameCount(8.3, 30)).toBe(249);
    expect(getTotalFrameCount(16.1, 30)).toBe(483);
    expect(getTotalFrameCount(16.6, 30)).toBe(498);
    // 2.2 * 25 is exactly 55 mathematically but 55.00000000000001 in floating point.
    expect(2.2 * 25).toBeGreaterThan(55);
    expect(getTotalFrameCount(2.2, 25)).toBe(55);
    // Exactly integral seconds are exact in floating point too.
    expect(getTotalFrameCount(4, 30)).toBe(120);

    const validation = validateExportInput({ sceneCount: 1, totalDuration: 8.3, fps: 30 });
    expect(validation.totalFrameCount).toBe(249);
  });

  it("still rounds genuinely fractional frame counts up", () => {
    // 4.1s is fractional in seconds but exactly 123 frames at 30fps.
    expect(getTotalFrameCount(4.1, 30)).toBe(123);
    // 124.5 frames really does need the ceiling: the final partial frame exists.
    expect(getTotalFrameCount(4.15, 30)).toBe(125);
  });

  it("rejects exports with no scenes", () => {
    const validation = validateExportInput({ sceneCount: 0, totalDuration: 2, fps: 30 });

    expect(validation.valid).toBe(false);
    expect(validation.reason).toMatch(/scene/i);
    expect(validation.totalFrameCount).toBe(60);
  });

  it("rejects zero, negative, and non-finite durations", () => {
    for (const totalDuration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const validation = validateExportInput({ sceneCount: 2, totalDuration, fps: 30 });

      expect(validation.valid, String(totalDuration)).toBe(false);
      expect(validation.reason, String(totalDuration)).toMatch(/duration/i);
    }
  });

  it("rejects an invalid frame sequence before ffmpeg is invoked", () => {
    const validation = validateExportInput({ sceneCount: 1, totalDuration: Number.MAX_VALUE, fps: 60 });

    expect(validation.valid).toBe(false);
    expect(validation.reason).toMatch(/frame/i);
    expect(validation.totalFrameCount).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("generation-scoped artifact names", () => {
  it("names frames, palettes, and outputs for one generation only", () => {
    expect(getExportArtifactNames(7, "gif")).toEqual({
      frameDirectory: "frames-7",
      paletteFileName: "palette-7.png",
      outputFileName: "output-7.gif",
      outputExtension: "gif",
    });
    expect(getExportArtifactNames(7, "reels")).toEqual({
      frameDirectory: "frames-7",
      paletteFileName: "palette-7.png",
      outputFileName: "output-7.mp4",
      outputExtension: "mp4",
    });
  });

  it("never reuses mutable output artifact names across generations", () => {
    const first = getExportArtifactNames(1, "mp4");
    const second = getExportArtifactNames(2, "mp4");

    expect(first.frameDirectory).not.toBe(second.frameDirectory);
    expect(first.paletteFileName).not.toBe(second.paletteFileName);
    expect(first.outputFileName).not.toBe(second.outputFileName);
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
