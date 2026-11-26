// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { parseMarkdown } from "@markdown-video/core";
import { SceneFrame } from "../SceneFrame.js";

/**
 * Transition integration tests against the composed frame. These used to
 * drive the editor shell through the zustand store; the frame composition is
 * now the package's contract, so the tests feed it parsed scenes and explicit
 * scene times directly — the same inputs the shell and headless hosts use.
 * Shell-level wiring (store markdown to fitted frame) remains covered by the
 * layout integration tests in the app.
 */

function renderAtTime(markdown: string, sceneTime: number) {
  const scene = parseMarkdown(markdown)[0];
  return render(
    createElement(SceneFrame, { scene, sceneTime, aspectRatio: "16:9" })
  );
}

function sceneTransitionLayer(container: HTMLElement): HTMLElement {
  const preview = container.querySelector('[data-scene-preview="true"]');
  const layer = preview?.firstElementChild;
  if (!(layer instanceof HTMLElement)) {
    throw new Error("Scene transition layer was not rendered");
  }
  return layer;
}

afterEach(cleanup);

describe("SceneFrame transition duration integration", () => {
  it("uses a parsed custom transitionDuration for deterministic transition progress", async () => {
    const { container } = renderAtTime(
      `!scene
!duration 4
!transition fade 2s
!text
Hello
`,
      0.5
    );

    // 0.5s into a 2s transition is exactly one quarter visible.
    await waitFor(() =>
      expect(sceneTransitionLayer(container).style.opacity).toBe("0.25")
    );
  });

  it("uses the schema default duration when transitionDuration is absent", async () => {
    const { container } = renderAtTime(
      `!scene
!duration 4
!transition fade
!text
Hello
`,
      0.25
    );

    await waitFor(() =>
      expect(sceneTransitionLayer(container).style.opacity).toBe("0.5")
    );
  });

  it("falls back safely instead of dividing by a zero/invalid duration", async () => {
    const { container } = renderAtTime(
      `!scene
!duration 4
!transition fade 0s
!text
Hello
`,
      0.25
    );

    await waitFor(() => {
      const opacity = sceneTransitionLayer(container).style.opacity;
      expect(opacity).toBe("0.5");
      expect(opacity).not.toBe("NaN");
      expect(opacity).not.toBe("Infinity");
    });
  });
});
