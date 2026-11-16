import { describe, expect, it } from "vitest";
import { getExportDimensions } from "../export-utils";

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
