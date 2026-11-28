// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useVideoStore } from "@/lib/use-video-store";
import FfmpegRender from "../FfmpegRender";

vi.mock("html2canvas-pro", () => ({
  default: vi.fn(async () => ({
    toBlob: (callback: (blob: Blob | null) => void) =>
      callback(new Blob([new Uint8Array([1])])),
  })),
}));

vi.mock("@/lib/assets/asset-resolution", () => ({
  warmBrowserAssetSources: vi.fn(async () => {}),
}));

const originalMarkdown = useVideoStore.getState().markdown;

function createFfmpegMock() {
  return {
    loaded: true,
    on: vi.fn(),
    off: vi.fn(),
    exec: vi.fn(async () => 0),
    createDir: vi.fn(async () => true),
    writeFile: vi.fn(async () => true),
    readFile: vi.fn(async () => new Uint8Array([1])),
    deleteFile: vi.fn(async () => true),
    deleteDir: vi.fn(async () => true),
    terminate: vi.fn(),
  };
}

function setVisibility(state: string) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("FfmpegRender background-tab indicator", () => {
  afterEach(() => {
    cleanup();
    setVisibility("visible");
    useVideoStore.getState().setMarkdown(originalMarkdown, false);
    vi.restoreAllMocks();
  });

  it("shows a paused message when the tab is hidden during capture setup", async () => {
    if (!document.fonts) {
      Object.defineProperty(document, "fonts", {
        configurable: true,
        value: { ready: Promise.resolve() },
      });
    }
    // jsdom canvases have no 2D context; the pipeline only needs the
    // transform/reset calls before html2canvas is replaced by the mock above.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: () => {},
      clearRect: () => {},
    } as unknown as CanvasRenderingContext2D);

    const preview = document.createElement("div");
    preview.setAttribute("data-scene-preview", "true");
    document.body.appendChild(preview);

    useVideoStore.getState().setMarkdown("!scene\n!duration 1\n!text\nHi\n", false);

    const ffmpeg = createFfmpegMock();
    render(
      <FfmpegRender
        loadFunction={vi.fn(async () => {})}
        loadFfmpeg={true}
        ffmpeg={ffmpeg as never}
      />
    );

    setVisibility("hidden");
    fireEvent.click(screen.getByText("Start Rendering"));

    expect(
      await screen.findByText(
        "Paused — this tab is in the background. Return to it to continue."
      )
    ).toBeTruthy();

    preview.remove();
  });

  it("does not show the pause message while the tab is visible", async () => {
    const preview = document.createElement("div");
    preview.setAttribute("data-scene-preview", "true");
    document.body.appendChild(preview);

    const ffmpeg = createFfmpegMock();
    render(
      <FfmpegRender
        loadFunction={vi.fn(async () => {})}
        loadFfmpeg={true}
        ffmpeg={ffmpeg as never}
      />
    );

    expect(
      screen.queryByText(
        "Paused — this tab is in the background. Return to it to continue."
      )
    ).toBeNull();

    preview.remove();
  });
});
