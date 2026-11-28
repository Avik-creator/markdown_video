// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useVideoStore } from "@/lib/use-video-store";
import FfmpegRender from "../FfmpegRender";

const snapdomState = vi.hoisted(() => ({
  toCanvas: vi.fn(async (_el: unknown, opts: { canvas: unknown }) => {
    void _el;
    return opts.canvas;
  }),
  accessCount: 0,
}));

// Simulates a deploy-skew chunk load failure: the first dynamic import of
// @zumer/snapdom rejects via a throwing module getter.
vi.mock("@zumer/snapdom", () => ({
  get snapdom() {
    snapdomState.accessCount += 1;
    if (snapdomState.accessCount === 1) {
      throw new Error("Failed to fetch dynamically imported module");
    }
    return { toCanvas: snapdomState.toCanvas };
  },
}));

const webcodecsMock = vi.hoisted(() => ({
  addFrame: vi.fn(async (_canvas: unknown, _frameIndex: number) => {
    void _canvas;
    void _frameIndex;
  }),
  finalize: vi.fn(async () => new Uint8Array([1, 2, 3])),
  close: vi.fn(),
  isSupported: vi.fn(() => true),
  selectConfig: vi.fn(async () => ({ codec: "avc1.640028" }) as never),
  WebCodecsEncoderError: class WebCodecsEncoderError extends Error {},
}));

vi.mock("@/components/video-editor/export-modal/utils/webcodecs-export", () => ({
  isWebCodecsExportSupported: webcodecsMock.isSupported,
  selectWebCodecsVideoConfig: webcodecsMock.selectConfig,
  createWebCodecsMp4Encoder: vi.fn(() => ({
    addFrame: webcodecsMock.addFrame,
    finalize: webcodecsMock.finalize,
    close: webcodecsMock.close,
  })),
  WebCodecsEncoderError: webcodecsMock.WebCodecsEncoderError,
}));

vi.mock(
  "@/components/video-editor/export-modal/utils/export-media",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/components/video-editor/export-modal/utils/export-media")
      >();
    return {
      ...actual,
      fetchBrowserMusicData: vi.fn(async () => new Uint8Array([7])),
    };
  }
);

const html2canvasMock = vi.hoisted(() =>
  vi.fn(async () => ({
    toBlob: (callback: (blob: Blob | null) => void) =>
      callback(
        Object.assign(new Blob([new Uint8Array([1])]), {
          arrayBuffer: async () => new Uint8Array([1]).buffer,
        })
      ),
  }))
);

vi.mock("html2canvas-pro", () => ({ default: html2canvasMock }));

vi.mock("@/lib/assets/asset-resolution", () => ({
  warmBrowserAssetSources: vi.fn(async () => {}),
}));

const originalMarkdown = useVideoStore.getState().markdown;

describe("FfmpegRender snapdom chunk-load failure", { timeout: 20_000 }, () => {
  beforeEach(() => {
    if (!document.fonts) {
      Object.defineProperty(document, "fonts", {
        configurable: true,
        value: { ready: Promise.resolve() },
      });
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: () => {},
      resetTransform: () => {},
      clearRect: () => {},
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D);
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    document
      .querySelectorAll("[data-scene-preview]")
      .forEach((el) => el.parentElement?.remove());
    useVideoStore.getState().setMarkdown(originalMarkdown, false);
    snapdomState.toCanvas.mockClear();
    snapdomState.accessCount = 0;
    html2canvasMock.mockClear();
    webcodecsMock.addFrame.mockClear();
    webcodecsMock.selectConfig.mockClear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("treats a failed snapdom import as capture failure and auto-retries on html2canvas", async () => {
    useVideoStore
      .getState()
      .setMarkdown("!scene\n!duration 0.5\n!text\nHi\n", false);
    const preview = document.createElement("div");
    preview.setAttribute("data-scene-preview", "true");
    const parent = document.createElement("div");
    parent.appendChild(preview);
    document.body.appendChild(parent);
    const ffmpeg = {
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
    render(
      <FfmpegRender
        loadFunction={vi.fn(async () => {})}
        loadFfmpeg={true}
        ffmpeg={ffmpeg as never}
      />
    );
    fireEvent.click(screen.getByText("Start Rendering"));

    await screen.findByText("Your video is ready to download", undefined, {
      timeout: 15_000,
    });
    expect(screen.queryByText("Export Failed")).toBeNull();
    expect(
      sessionStorage.getItem("markdown-video:snapdom-capture-disabled")
    ).toBe("1");
    // The retry skipped the snapdom import entirely and used html2canvas.
    expect(snapdomState.accessCount).toBe(1);
    expect(snapdomState.toCanvas).not.toHaveBeenCalled();
    expect(html2canvasMock).toHaveBeenCalledTimes(15);
    const opts = (html2canvasMock.mock.calls[0] as unknown[] | undefined)?.[1] as {
      ignoreElements?: (el: Element) => boolean;
    };
    expect(typeof opts.ignoreElements).toBe("function");
  });
});
