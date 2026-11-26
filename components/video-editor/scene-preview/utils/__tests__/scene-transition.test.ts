// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

// Node 22 exposes a localStorage global without backing storage in this test
// environment. Replace it before zustand's persist middleware initializes.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return data.size;
      },
      clear: () => data.clear(),
      getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
      key: (index: number) => Array.from(data.keys())[index] ?? null,
      removeItem: (key: string) => {
        data.delete(key);
      },
      setItem: (key: string, value: string) => {
        data.set(key, String(value));
      },
    },
  });
});
import { createElement } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { ScenePreview } from "../../../scene-preview";
import { useVideoStore } from "@/lib/use-video-store";

const originalMarkdown = useVideoStore.getState().markdown;

function renderAtTime(markdown: string, time: number) {
  useVideoStore.getState().setMarkdown(markdown, false);
  useVideoStore.getState().seekTo(time);
  return render(createElement(ScenePreview));
}

function sceneTransitionLayer(container: HTMLElement): HTMLElement {
  const preview = container.querySelector('[data-scene-preview="true"]');
  const layer = preview?.firstElementChild;
  if (!(layer instanceof HTMLElement)) {
    throw new Error("Scene transition layer was not rendered");
  }
  return layer;
}

afterEach(() => {
  cleanup();
  useVideoStore.getState().setMarkdown(originalMarkdown, false);
  useVideoStore.getState().seekTo(0);
});

describe("ScenePreview transition duration integration", () => {
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
