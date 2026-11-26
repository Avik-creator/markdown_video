import { describe, expect, it } from "vitest";
import {
  FIXED_RENDER_LAYOUT_WIDTH,
  LOGICAL_ROOT_FONT_SIZE_PX,
  RENDER_LAYOUT_SHORT_SIDE,
  getRenderLayoutDimensions,
  getSceneAspectRatioDimensions,
} from "../render-layout";
import { getRenderLayoutDimensions as getExportRenderLayoutDimensions } from "../../../export-modal/utils/export-utils";

describe("render-layout canonical geometry", () => {
  it("uses a 1080px short side in logical composition space", () => {
    expect(RENDER_LAYOUT_SHORT_SIDE).toBe(1080);
    expect(FIXED_RENDER_LAYOUT_WIDTH).toBe(1920);
    expect(LOGICAL_ROOT_FONT_SIZE_PX).toBe(16);

    expect(getRenderLayoutDimensions("16:9")).toEqual({ width: 1920, height: 1080 });
    expect(getRenderLayoutDimensions("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(getRenderLayoutDimensions("1:1")).toEqual({ width: 1080, height: 1080 });
    expect(getRenderLayoutDimensions("4:3")).toEqual({ width: 1440, height: 1080 });
  });

  it("falls back to 16:9 for unknown aspect ratios", () => {
    expect(getSceneAspectRatioDimensions("21:9")).toEqual([16, 9]);
    expect(getRenderLayoutDimensions("21:9")).toEqual({ width: 1920, height: 1080 });
  });

  it("is the same implementation export-utils re-exports", () => {
    expect(getExportRenderLayoutDimensions).toBe(getRenderLayoutDimensions);
  });
});
