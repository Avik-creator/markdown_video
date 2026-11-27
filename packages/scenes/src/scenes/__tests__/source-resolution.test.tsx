import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMarkdown } from "@markdown-video/core";
import { SceneFrame } from "../../frame/SceneFrame.js";

function renderFrame(markdown: string, resolveSrc?: (src: string) => string) {
  const scene = parseMarkdown(markdown)[0];
  return renderToStaticMarkup(
    createElement(SceneFrame, {
      scene,
      sceneTime: 0.5,
      aspectRatio: "16:9",
      ...(resolveSrc ? { resolveSrc } : {}),
    })
  );
}

describe("scene media source resolution", () => {
  it("uses the identity mapping by default", () => {
    const html = renderFrame(`!scene
!image src:./logo.png fit:contain
`);

    expect(html).toContain('src="./logo.png"');
  });

  it("passes image sources through the host resolver", () => {
    const html = renderFrame(
      `!scene
!image src:./logo.png fit:contain
`,
      (src) => (src.startsWith("./") ? `blob:host/${src.slice(2)}` : src)
    );

    expect(html).toContain('src="blob:host/logo.png"');
  });

  it("applies one host resolver inside nested split panels", () => {
    const html = renderFrame(
      `!scene
!layout split:horizontal
left:
!image src:./left.png
right:
!image src:./right.png
`,
      (src) => (src.startsWith("./") ? `/resolved/${src.slice(2)}` : src)
    );

    expect(html).toContain('src="/resolved/left.png"');
    expect(html).toContain('src="/resolved/right.png"');
  });
});
