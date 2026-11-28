// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useVideoStore } from "@/lib/use-video-store";
import FfmpegRender from "../FfmpegRender";

const analyticsMock = vi.hoisted(() => ({
  trackExportEvent: vi.fn(),
}));

vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, trackExportEvent: analyticsMock.trackExportEvent };
});

const snapdomMock = vi.hoisted(() => ({
  toCanvas: vi.fn(async (_el: unknown, opts: { canvas: unknown }) => {
    void _el;
    return Object.assign(opts.canvas as object, {
      toBlob: (callback: (blob: Blob | null) => void) =>
        callback(
          Object.assign(new Blob([new Uint8Array([1])]), {
            arrayBuffer: async () => new Uint8Array([1]).buffer,
          })
        ),
    });
  }),
}));

vi.mock("@zumer/snapdom", () => ({
  snapdom: { toCanvas: snapdomMock.toCanvas },
}));

const webcodecsMock = vi.hoisted(() => {
  class WebCodecsEncoderError extends Error {
    codec: string;
    constructor(message: string, codec = "avc1.640028") {
      super(message);
      this.name = "WebCodecsEncoderError";
      this.codec = codec;
    }
  }
  return {
    addFrame: vi.fn(async (_canvas: unknown, _frameIndex: number) => {
      void _canvas;
      void _frameIndex;
    }),
    finalize: vi.fn(async () => new Uint8Array([1, 2, 3])),
    close: vi.fn(),
    isSupported: vi.fn(() => true),
    selectConfig: vi.fn(async () => ({ codec: "avc1.640028" }) as never),
    WebCodecsEncoderError,
  };
});

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

function renderExport(ffmpeg = createFfmpegMock()) {
  const preview = document.createElement("div");
  preview.setAttribute("data-scene-preview", "true");
  const parent = document.createElement("div");
  parent.appendChild(preview);
  document.body.appendChild(parent);
  render(
    <FfmpegRender
      ensureFFmpeg={vi.fn(async () => ffmpeg as never)}
    />
  );
  return { ffmpeg, preview, parent };
}

const SHORT_DOC = "!scene\n!duration 0.5\n!text\nHi\n";

function eventNames() {
  return analyticsMock.trackExportEvent.mock.calls.map(([name]) => name);
}

describe("FfmpegRender automatic compatibility retry", { timeout: 20_000 }, () => {
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
    snapdomMock.toCanvas.mockReset();
    snapdomMock.toCanvas.mockImplementation(
      async (_el: unknown, opts: { canvas: unknown }) => {
        void _el;
        return Object.assign(opts.canvas as object, {
          toBlob: (callback: (blob: Blob | null) => void) =>
            callback(
              Object.assign(new Blob([new Uint8Array([1])]), {
                arrayBuffer: async () => new Uint8Array([1]).buffer,
              })
            ),
        });
      }
    );
    html2canvasMock.mockClear();
    webcodecsMock.addFrame.mockClear();
    webcodecsMock.finalize.mockClear();
    webcodecsMock.close.mockClear();
    webcodecsMock.selectConfig.mockClear();
    analyticsMock.trackExportEvent.mockClear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("auto-retries on the ffmpeg path after a WebCodecsEncoderError — no error UI", async () => {
    webcodecsMock.addFrame.mockRejectedValueOnce(
      new webcodecsMock.WebCodecsEncoderError("encoder wedged", "avc1.640028")
    );
    useVideoStore.getState().setMarkdown(SHORT_DOC, false);
    const { ffmpeg } = renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));

    // The retry completes without any user click or error UI.
    await screen.findByText("Your video is ready to download", undefined, {
      timeout: 15_000,
    });
    expect(screen.queryByText("Export Failed")).toBeNull();
    expect(
      sessionStorage.getItem("markdown-video:webcodecs-export-disabled")
    ).toBe("1");
    // Second run took the legacy path: frame files written + libx264 exec.
    const writtenPaths = (ffmpeg.writeFile.mock.calls as unknown[][]).map(
      ([p]) => String(p)
    );
    expect(writtenPaths.some((p) => /frame\d{5}/.test(p))).toBe(true);
    expect(ffmpeg.exec).toHaveBeenCalled();
    // Config selection ran only on the first run.
    expect(webcodecsMock.selectConfig).toHaveBeenCalledTimes(1);
    const names = eventNames();
    expect(names.filter((n) => n === "export_failed")).toHaveLength(1);
    expect(names.filter((n) => n === "export_finished")).toHaveLength(1);
  });

  it("auto-retries on html2canvas after a frame-0 snapdom failure", async () => {
    snapdomMock.toCanvas.mockRejectedValueOnce(new Error("svg raster broke"));
    useVideoStore.getState().setMarkdown(SHORT_DOC, false);
    renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));

    await screen.findByText("Your video is ready to download", undefined, {
      timeout: 15_000,
    });
    expect(screen.queryByText("Export Failed")).toBeNull();
    expect(
      sessionStorage.getItem("markdown-video:snapdom-capture-disabled")
    ).toBe("1");
    // snapdom ran once on the failed run; the retry used html2canvas only.
    expect(snapdomMock.toCanvas).toHaveBeenCalledTimes(1);
    expect(html2canvasMock).toHaveBeenCalledTimes(15);
  });

  it("shows the retry's error when the retry also fails — no third run", async () => {
    snapdomMock.toCanvas.mockRejectedValue(new Error("svg raster broke"));
    html2canvasMock.mockRejectedValue(new Error("h2c also broken"));
    useVideoStore.getState().setMarkdown(SHORT_DOC, false);
    renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));

    await screen.findByText("Export Failed", undefined, { timeout: 15_000 });
    // snapdom called once (run 1, frame 0 throw); h2c called once on the
    // retry (frame 0 throw is fatal immediately). No further runs.
    expect(snapdomMock.toCanvas).toHaveBeenCalledTimes(1);
    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    const names = eventNames();
    expect(names.filter((n) => n === "export_failed")).toHaveLength(2);
    expect(names).not.toContain("export_finished");
  });

  it("treats a hung addFrame as an encoder failure and auto-retries on the legacy path", async () => {
    vi.useFakeTimers();
    webcodecsMock.addFrame.mockImplementationOnce(
      () => new Promise(() => {})
    );
    useVideoStore.getState().setMarkdown(SHORT_DOC, false);
    const { ffmpeg } = renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));

    // Flush the preparing waits, then let the 30s encoder watchdog fire.
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(
      sessionStorage.getItem("markdown-video:webcodecs-export-disabled")
    ).toBe("1");
    // Let the retry run its full course under fake timers.
    await vi.advanceTimersByTimeAsync(60_000);
    vi.useRealTimers();

    await screen.findByText("Your video is ready to download", undefined, {
      timeout: 15_000,
    });
    const writtenPaths = (ffmpeg.writeFile.mock.calls as unknown[][]).map(
      ([p]) => String(p)
    );
    expect(writtenPaths.some((p) => /frame\d{5}/.test(p))).toBe(true);
    const names = eventNames();
    expect(names.filter((n) => n === "export_failed")).toHaveLength(1);
    expect(names.filter((n) => n === "export_finished")).toHaveLength(1);
  });
});
