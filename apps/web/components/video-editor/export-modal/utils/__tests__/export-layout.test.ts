// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { createRenderPlan } from "@markdown-video/core";
import { applyRenderLayoutToClone } from "../export-utils";

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
