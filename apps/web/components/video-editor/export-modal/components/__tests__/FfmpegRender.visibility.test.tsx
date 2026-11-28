// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useVideoStore } from "@/lib/use-video-store";
import FfmpegRender from "../FfmpegRender";

vi.mock("@zumer/snapdom", () => ({
  snapdom: {
    toCanvas: vi.fn(async (_el: unknown, opts: { canvas: unknown }) =>
      // jsdom canvases have no toBlob; the ffmpeg frame-write path needs one.
      Object.assign(opts.canvas as object, {
        toBlob: (callback: (blob: Blob | null) => void) =>
          callback(
            Object.assign(new Blob([new Uint8Array([1])]), {
              arrayBuffer: async () => new Uint8Array([1]).buffer,
            })
          ),
      })
    ),
  },
}));

vi.mock("html2canvas-pro", () => ({
  default: vi.fn(async () => ({
    toBlob: (callback: (blob: Blob | null) => void) =>
      callback(new Blob([new Uint8Array([1])])),
  })),
}));


vi.mock(
  "@/components/video-editor/export-modal/utils/webcodecs-audio",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/components/video-editor/export-modal/utils/webcodecs-audio")
      >();
    return {
      ...actual,
      selectWebCodecsAudioCodec: vi.fn(async () => null),
      renderMusicAudioBuffer: vi.fn(async () => ({}) as AudioBuffer),
    };
  }
);

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
        ensureFFmpeg={vi.fn(async () => ffmpeg as never)}
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
        ensureFFmpeg={vi.fn(async () => ffmpeg as never)}
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
