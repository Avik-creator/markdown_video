// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { ScenePreview } from "../../../scene-preview";
import { useVideoStore } from "@/lib/use-video-store";

const originalMarkdown = useVideoStore.getState().markdown;

function rect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockFittedBox(width: number, height: number) {
  return vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      return this.dataset.scenePreviewFit === "true"
        ? rect(width, height)
        : rect(0, 0);
    });
}

function matrixParts(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    throw new Error("Logical scene frame was not rendered");
  }
  const match = element.style.transform.match(
    /^matrix\(([^,]+), 0, 0, [^,]+, ([^,]+), ([^)]+)\)$/
  );
  if (!match) {
    throw new Error(`Expected a matrix transform, got: ${element.style.transform}`);
  }
  return {
    scale: Number(match[1]),
    translateX: Number(match[2]),
    translateY: Number(match[3]),
  };
}

function renderSimpleScene() {
  useVideoStore.getState().setMarkdown(
    `!scene
!duration 3s
!text
Hello logical layout
`,
    false
  );
  useVideoStore.getState().seekTo(1);
  return render(createElement(ScenePreview));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useVideoStore.getState().setZoom(100);
  useVideoStore.getState().setAspectRatio("16:9");
  useVideoStore.getState().setMarkdown(originalMarkdown, false);
  useVideoStore.getState().seekTo(0);
});

describe("ScenePreview logical composition layout", () => {
  it("puts data-scene-preview on a fixed logical frame inside a fitted sizing shell", () => {
    mockFittedBox(896, 504);
    const { container } = renderSimpleScene();

    const shell = container.querySelector('[data-scene-preview-fit="true"]');
    const logicalFrame = container.querySelector('[data-scene-preview="true"]');

    expect(shell).not.toBeNull();
    expect(logicalFrame?.parentElement).toBe(shell);
    expect(shell?.hasAttribute("data-scene-preview")).toBe(false);

    if (!(logicalFrame instanceof HTMLElement)) {
      throw new Error("Logical scene frame was not rendered");
    }
    expect(logicalFrame.style.width).toBe("1920px");
    expect(logicalFrame.style.height).toBe("1080px");
    expect(logicalFrame.style.fontSize).toBe("16px");
    expect(logicalFrame.style.visibility).toBe("visible");
    expect(logicalFrame.style.transformOrigin).toBe("0 0");

    const transform = matrixParts(logicalFrame);
    expect(transform.scale).toBeCloseTo(896 / 1920, 5);
    expect(Math.abs(transform.translateX)).toBeLessThan(0.001);
    expect(Math.abs(transform.translateY)).toBeLessThan(0.001);
  });

  it("composes the user zoom multiplicatively with the fitted scale", () => {
    mockFittedBox(896, 504);
    const { container } = renderSimpleScene();
    const logicalFrame = container.querySelector('[data-scene-preview="true"]');
    const base = matrixParts(logicalFrame);

    act(() => useVideoStore.getState().setZoom(125));

    const zoomed = matrixParts(logicalFrame);
    expect(zoomed.scale / base.scale).toBeCloseTo(1.25, 3);
    expect(zoomed.translateX).toBeCloseTo((896 - 1920 * base.scale * 1.25) / 2, 2);
    expect(zoomed.translateY).toBeCloseTo((504 - 1080 * base.scale * 1.25) / 2, 2);
  });
});
