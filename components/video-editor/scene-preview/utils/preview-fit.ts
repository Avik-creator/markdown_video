export interface PreviewSize {
  width: number;
  height: number;
}

export interface PreviewFitTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

function formatTransformNumber(value: number) {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/**
 * Calculate the transform that displays a fixed logical-size scene frame in a
 * fitted on-screen box.
 *
 * The fit scale is uniform. User zoom is then applied multiplicatively around
 * the center of the fitted box, matching the preview zoom control's historical
 * behavior. Positive translation letterboxes a zoomed-out frame; negative
 * translation keeps the center stationary while a zoomed-in frame overflows.
 */
export function calculatePreviewFitTransform({
  fittedWidth,
  fittedHeight,
  logicalWidth,
  logicalHeight,
  zoomPercent = 100,
}: {
  fittedWidth: number;
  fittedHeight: number;
  logicalWidth: number;
  logicalHeight: number;
  zoomPercent?: number;
}): PreviewFitTransform | null {
  if (
    !isPositiveFinite(fittedWidth) ||
    !isPositiveFinite(fittedHeight) ||
    !isPositiveFinite(logicalWidth) ||
    !isPositiveFinite(logicalHeight)
  ) {
    return null;
  }

  const fitScale = Math.min(
    fittedWidth / logicalWidth,
    fittedHeight / logicalHeight
  );
  const zoomScale = isPositiveFinite(zoomPercent) ? zoomPercent / 100 : 1;
  const scale = fitScale * zoomScale;

  return {
    scale,
    translateX: (fittedWidth - logicalWidth * scale) / 2,
    translateY: (fittedHeight - logicalHeight * scale) / 2,
  };
}

/**
 * Serialize as a matrix so the translation is explicitly in final screen
 * pixels. With transform-origin pinned to the top left this maps logical point
 * (x, y) to (scale*x + translateX, scale*y + translateY), independent of CSS
 * transform-list ordering subtleties.
 */
export function previewFitTransformToCss(transform: PreviewFitTransform) {
  return `matrix(${formatTransformNumber(transform.scale)}, 0, 0, ${formatTransformNumber(
    transform.scale
  )}, ${formatTransformNumber(transform.translateX)}, ${formatTransformNumber(
    transform.translateY
  )})`;
}
