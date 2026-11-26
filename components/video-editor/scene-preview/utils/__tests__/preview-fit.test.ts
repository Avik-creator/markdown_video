import { describe, expect, it } from "vitest";
import {
  calculatePreviewFitTransform,
  previewFitTransformToCss,
} from "../preview-fit";

describe("calculatePreviewFitTransform", () => {
  it("uniformly scales a logical 16:9 frame into a same-aspect fitted box", () => {
    const transform = calculatePreviewFitTransform({
      fittedWidth: 896,
      fittedHeight: 504,
      logicalWidth: 1920,
      logicalHeight: 1080,
    });

    expect(transform).not.toBeNull();
    expect(transform?.scale).toBeCloseTo(896 / 1920, 10);
    expect(transform?.translateX).toBeCloseTo(0, 8);
    expect(transform?.translateY).toBeCloseTo(0, 8);
  });

  it("letterboxes when the fitted box is taller than the logical frame", () => {
    const transform = calculatePreviewFitTransform({
      fittedWidth: 100,
      fittedHeight: 100,
      logicalWidth: 1920,
      logicalHeight: 1080,
    });

    expect(transform?.scale).toBeCloseTo(100 / 1920, 10);
    expect(transform?.translateX).toBeCloseTo(0, 8);
    expect(transform?.translateY).toBeCloseTo((100 - 1080 * (100 / 1920)) / 2, 8);
  });

  it("composes zoom multiplicatively around the center when zooming in", () => {
    const transform = calculatePreviewFitTransform({
      fittedWidth: 800,
      fittedHeight: 450,
      logicalWidth: 1920,
      logicalHeight: 1080,
      zoomPercent: 125,
    });

    const expectedScale = (800 / 1920) * 1.25;
    expect(transform?.scale).toBeCloseTo(expectedScale, 10);
    expect(transform?.translateX).toBeCloseTo((800 - 1920 * expectedScale) / 2, 8);
    expect(transform?.translateY).toBeCloseTo((450 - 1080 * expectedScale) / 2, 8);
    expect(transform?.translateX).toBeLessThan(0);
    expect(transform?.translateY).toBeLessThan(0);
  });

  it("composes zoom multiplicatively around the center when zooming out", () => {
    const transform = calculatePreviewFitTransform({
      fittedWidth: 800,
      fittedHeight: 450,
      logicalWidth: 1920,
      logicalHeight: 1080,
      zoomPercent: 50,
    });

    const expectedScale = (800 / 1920) * 0.5;
    expect(transform?.scale).toBeCloseTo(expectedScale, 10);
    expect(transform?.translateX).toBeCloseTo((800 - 1920 * expectedScale) / 2, 8);
    expect(transform?.translateY).toBeCloseTo((450 - 1080 * expectedScale) / 2, 8);
    expect(transform?.translateX).toBeGreaterThan(0);
    expect(transform?.translateY).toBeGreaterThan(0);
  });

  it("rejects zero, negative, and non-finite dimensions", () => {
    for (const size of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        calculatePreviewFitTransform({
          fittedWidth: size,
          fittedHeight: 450,
          logicalWidth: 1920,
          logicalHeight: 1080,
        })
      ).toBeNull();
    }
  });
});

describe("previewFitTransformToCss", () => {
  it("serializes scale and translation as a top-left-origin matrix", () => {
    expect(
      previewFitTransformToCss({ scale: 0.5, translateX: 10, translateY: -20 })
    ).toBe("matrix(0.5, 0, 0, 0.5, 10, -20)");
  });

  it("rounds tiny precision noise without emitting negative zero", () => {
    expect(
      previewFitTransformToCss({
        scale: 1,
        translateX: -0.0000001,
        translateY: 0,
      })
    ).toBe("matrix(1, 0, 0, 1, 0, 0)");
  });
});
