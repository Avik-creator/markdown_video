/**
 * Canonical logical scene-composition geometry.
 *
 * Scene content is authored in ordinary CSS units (notably rem/em). The live
 * preview therefore lays scenes out in this fixed logical coordinate space and
 * scales the already-composed frame for display, while exports rasterize the
 * same logical composition at the requested output resolution.
 */

export const SCENE_ASPECT_RATIO_DIMENSIONS: Record<
  string,
  readonly [number, number]
> = {
  "16:9": [16, 9],
  "9:16": [9, 16],
  "1:1": [1, 1],
  "4:3": [4, 3],
};

export const FIXED_RENDER_LAYOUT_WIDTH = 1920;
export const RENDER_LAYOUT_SHORT_SIDE = 1080;
export const LOGICAL_ROOT_FONT_SIZE_PX = 16;

// libx264 needs even raster dimensions; keeping the logical dimensions even
// also avoids fractional composition edges at the canonical 1080p size.
const even = (n: number) => Math.round(n / 2) * 2;

export function getSceneAspectRatioDimensions(
  aspectRatio: string = "16:9"
): readonly [number, number] {
  return (
    SCENE_ASPECT_RATIO_DIMENSIONS[aspectRatio] ??
    SCENE_ASPECT_RATIO_DIMENSIONS["16:9"]
  );
}

/**
 * Canonical logical composition dimensions for an aspect ratio.
 *
 * The short side is always 1080 logical CSS pixels. Landscape 16:9 therefore
 * composes at 1920x1080, portrait 9:16 at 1080x1920, square at 1080x1080, and
 * 4:3 at 1440x1080. These dimensions intentionally do not depend on either
 * the on-screen preview size or the selected export resolution.
 */
export function getRenderLayoutDimensions(aspectRatio: string = "16:9") {
  const [w, h] = getSceneAspectRatioDimensions(aspectRatio);
  return w >= h
    ? {
        width: even((RENDER_LAYOUT_SHORT_SIDE * w) / h),
        height: RENDER_LAYOUT_SHORT_SIDE,
      }
    : {
        width: RENDER_LAYOUT_SHORT_SIDE,
        height: even((RENDER_LAYOUT_SHORT_SIDE * h) / w),
      };
}
