// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { createRenderPlan } from "@markdown-video/core";
import {
  applyRenderLayoutToClone,
  applyRenderLayoutToElement,
  ensureRenderLayout,
} from "../export-utils";

function createCloneDocument(withPreview = true) {
  const clonedDoc = document.implementation.createHTMLDocument("export clone");
  if (withPreview) {
    const preview = clonedDoc.createElement("div");
    preview.setAttribute("data-scene-preview", "true");
    preview.style.transform = "scale(0.5)";
    preview.style.width = "640px";
    preview.style.height = "360px";
    preview.style.aspectRatio = "16 / 9";
    preview.style.maxWidth = "56rem";
    preview.style.maxHeight = "20rem";
    preview.style.borderRadius = "8px";
    preview.style.visibility = "hidden";
    clonedDoc.body.appendChild(preview);
  }
  return clonedDoc;
}

describe("applyRenderLayoutToClone", () => {
  it("pins the clone to the render plan's vertical logical geometry", () => {
    const clonedDoc = createCloneDocument();
    const preview = clonedDoc.querySelector<HTMLElement>('[data-scene-preview="true"]');
    const plan = createRenderPlan({
      resolution: "1080p",
      projectAspectRatio: "16:9",
      format: "reels",
    });

    const applied = applyRenderLayoutToClone({
      clonedDoc,
      clonedElement: preview,
      renderPlan: plan,
    });

    expect(applied).toBe(true);
    expect(preview?.style.transform).toBe("none");
    expect(preview?.style.width).toBe("1080px");
    expect(preview?.style.height).toBe("1920px");
    expect(preview?.style.aspectRatio).toBe("auto");
    expect(preview?.style.maxWidth).toBe("none");
    expect(preview?.style.maxHeight).toBe("none");
    expect(preview?.style.flexShrink).toBe("0");
    expect(preview?.style.visibility).toBe("visible");
  });

  it("squares rounded corners so opaque JPEG frames do not get black matte corners", () => {
    const clonedDoc = createCloneDocument();
    const preview = clonedDoc.querySelector<HTMLElement>('[data-scene-preview="true"]');
    const plan = createRenderPlan({ resolution: "720p", format: "mp4" });

    applyRenderLayoutToClone({ clonedDoc, clonedElement: preview, renderPlan: plan });

    expect(preview?.style.borderRadius).toBe("0");
  });

  it("normalizes rem/em typography to a fixed logical font base", () => {
    const clonedDoc = createCloneDocument();
    const preview = clonedDoc.querySelector<HTMLElement>('[data-scene-preview="true"]');
    const hd = createRenderPlan({ resolution: "1080p", format: "shorts" });
    const sd = createRenderPlan({ resolution: "720p", format: "shorts" });

    applyRenderLayoutToClone({ clonedDoc, clonedElement: preview, renderPlan: sd });

    expect(clonedDoc.documentElement.style.fontSize).toBe("16px");
    expect(preview?.style.fontSize).toBe("16px");
    expect(sd.logicalFontSizePx).toBe(hd.logicalFontSizePx);
  });

  it("finds the preview inside the cloned document when html2canvas passes a wrapper", () => {
    const clonedDoc = createCloneDocument();
    const wrapper = clonedDoc.createElement("div");
    const plan = createRenderPlan({ resolution: "720p", format: "mp4" });

    const applied = applyRenderLayoutToClone({
      clonedDoc,
      clonedElement: wrapper,
      renderPlan: plan,
    });

    const preview = clonedDoc.querySelector<HTMLElement>('[data-scene-preview="true"]');
    expect(applied).toBe(true);
    expect(preview?.style.width).toBe("1920px");
    expect(preview?.style.height).toBe("1080px");
  });

  it("returns false instead of throwing when the scene preview is absent", () => {
    const clonedDoc = createCloneDocument(false);
    const plan = createRenderPlan({ resolution: "720p", format: "mp4" });

    expect(
      applyRenderLayoutToClone({
        clonedDoc,
        clonedElement: null,
        renderPlan: plan,
      })
    ).toBe(false);
  });
});

describe("applyRenderLayoutToElement", () => {
  function livePreview() {
    const el = document.createElement("div");
    el.setAttribute("data-scene-preview", "true");
    el.style.transform = "matrix(0.466667, 0, 0, 0.466667, 0, 0)";
    el.style.width = "1920px";
    el.style.height = "1080px";
    el.style.aspectRatio = "16 / 9";
    el.style.maxWidth = "56rem";
    el.style.maxHeight = "20rem";
    el.style.flexShrink = "1";
    el.style.fontSize = "14px";
    el.style.borderRadius = "8px";
    el.style.visibility = "hidden";
    document.body.appendChild(el);
    return el;
  }

  it("pins the live element to the render plan and restores the exact previous inline styles", () => {
    const el = livePreview();
    const plan = createRenderPlan({ resolution: "1080p", format: "mp4" });
    const styleKeys = [
      "transform","width","height","aspectRatio","maxWidth","maxHeight",
      "flexShrink","fontSize","borderRadius","visibility",
    ] as const;
    const before = Object.fromEntries(
      styleKeys.map((key) => [
        key,
        el.style.getPropertyValue(key) || String(el.style[key as never]),
      ])
    );

    const restore = applyRenderLayoutToElement(el, plan);

    expect(el.style.transform).toBe("none");
    expect(el.style.width).toBe("1920px");
    expect(el.style.height).toBe("1080px");
    expect(el.style.aspectRatio).toBe("auto");
    expect(el.style.maxWidth).toBe("none");
    expect(el.style.maxHeight).toBe("none");
    expect(el.style.flexShrink).toBe("0");
    expect(el.style.fontSize).toBe(`${plan.logicalFontSizePx}px`);
    expect(el.style.borderRadius).toBe("0");
    expect(el.style.visibility).toBe("visible");

    restore();
    for (const key of styleKeys) {
      expect(el.style.getPropertyValue(key) || el.style[key as never]).toBe(
        before[key] ?? ""
      );
    }
    expect(el.style.transform).toContain("0.466667");
    expect(el.style.visibility).toBe("hidden");
    el.remove();
  });

  it("applies the 9:16 logical geometry for reels", () => {
    const el = livePreview();
    const plan = createRenderPlan({
      resolution: "1080p",
      projectAspectRatio: "16:9",
      format: "reels",
    });
    applyRenderLayoutToElement(el, plan);
    expect(el.style.width).toBe("1080px");
    expect(el.style.height).toBe("1920px");
    el.remove();
  });

  it("restore is idempotent", () => {
    const el = livePreview();
    const restore = applyRenderLayoutToElement(
      el,
      createRenderPlan({ resolution: "720p", format: "mp4" })
    );
    restore();
    restore();
    expect(el.style.transform).toContain("0.466667");
    el.remove();
  });
});

describe("ensureRenderLayout", () => {
  it("is a no-op while the layout holds and re-applies on drift", () => {
    const el = document.createElement("div");
    el.setAttribute("data-scene-preview", "true");
    document.body.appendChild(el);
    const plan = createRenderPlan({ resolution: "1080p", format: "mp4" });
    applyRenderLayoutToElement(el, plan);

    expect(ensureRenderLayout(el, plan)).toBe(false);

    el.style.transform = "scale(0.5)";
    expect(ensureRenderLayout(el, plan)).toBe(true);
    expect(el.style.transform).toBe("none");
    expect(el.style.width).toBe("1920px");
    el.remove();
  });
});
