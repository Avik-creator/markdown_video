// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useVideoStore } from "@/lib/use-video-store";
import FfmpegRender from "../FfmpegRender";

const snapdomMock = vi.hoisted(() => ({
  toCanvas: vi.fn(async (_el: unknown, opts: { canvas: unknown }) => {
    void _el;
    // jsdom canvases have no toBlob; the ffmpeg frame-write path needs one.
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

function createFfmpegMock() {
  return {
    loaded: true,
    on: vi.fn(),
    off: vi.fn(),
    exec: vi.fn(async (_args?: unknown[]) => {
      void _args;
      return 0;
    }),
    createDir: vi.fn(async () => true),
    writeFile: vi.fn(async (_path?: string, _data?: Uint8Array) => {
      void _path;
      void _data;
      return true;
    }),
    readFile: vi.fn(async () => new Uint8Array([1])),
    deleteFile: vi.fn(async () => true),
    deleteDir: vi.fn(async () => true),
    terminate: vi.fn(),
  };
}

function renderExport(ffmpeg = createFfmpegMock()) {
  const preview = document.createElement("div");
  preview.setAttribute("data-scene-preview", "true");
  preview.style.transform = "matrix(0.466667, 0, 0, 0.466667, 0, 0)";
  preview.style.width = "1920px";
  preview.style.height = "1080px";
  const parent = document.createElement("div");
  parent.appendChild(preview);
  document.body.appendChild(parent);
  render(
    <FfmpegRender
      loadFunction={vi.fn(async () => {})}
      loadFfmpeg={true}
      ffmpeg={ffmpeg as never}
    />
  );
  return { ffmpeg, preview, parent };
}

describe("FfmpegRender snapdom capture path", { timeout: 20_000 }, () => {
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
    document.querySelectorAll("[data-scene-preview]").forEach((el) => el.parentElement?.remove());
    useVideoStore.getState().setMarkdown(originalMarkdown, false);
    snapdomMock.toCanvas.mockClear();
    html2canvasMock.mockClear();
    webcodecsMock.addFrame.mockClear();
    webcodecsMock.finalize.mockClear();
    webcodecsMock.close.mockClear();
    webcodecsMock.selectConfig.mockClear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("captures every frame with snapdom's SVG engine and never calls html2canvas", async () => {
    useVideoStore.getState().setMarkdown("!scene\n!duration 0.5\n!text\nHi\n", false);
    const { ffmpeg } = renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));
    await screen.findByText("Your video is ready to download", undefined, {
      timeout: 10_000,
    });

    expect(snapdomMock.toCanvas).toHaveBeenCalledTimes(15);
    expect(html2canvasMock).not.toHaveBeenCalled();
    for (const [, opts] of snapdomMock.toCanvas.mock.calls) {
      expect(opts).toMatchObject({
        width: 1920,
        height: 1080,
        dpr: 1,
        backgroundColor: "#000000",
        engine: "svg",
        cache: "disabled",
      });
      expect((opts as { canvas?: unknown }).canvas).toBeInstanceOf(HTMLCanvasElement);
    }
    const writtenPaths = ffmpeg.writeFile.mock.calls.map(([p]) => String(p));
    expect(writtenPaths.filter((p) => /frame\d{5}/.test(p))).toHaveLength(0);
  });

  it("applies the render layout before the first capture and restores after success", async () => {
    useVideoStore.getState().setMarkdown("!scene\n!duration 0.2\n!text\nHi\n", false);
    const { preview } = renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));

    await waitFor(() => expect(snapdomMock.toCanvas).toHaveBeenCalled(), {
      timeout: 10_000,
    });
    const firstCallEl = snapdomMock.toCanvas.mock.calls[0]?.[0] as HTMLElement;
    expect(firstCallEl.style.transform).toBe("none");
    expect(firstCallEl.style.width).toBe("1920px");
    expect(firstCallEl.style.height).toBe("1080px");

    await screen.findByText("Your video is ready to download", undefined, {
      timeout: 10_000,
    });
    expect(preview.style.transform).toContain("0.466667");
  });

  it("restores the preview layout after a mid-capture cancel", async () => {
    useVideoStore.getState().setMarkdown("!scene\n!duration 30\n!text\nHi\n", false);
    const { preview } = renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));

    await waitFor(() => expect(snapdomMock.toCanvas).toHaveBeenCalled(), {
      timeout: 10_000,
    });
    fireEvent.click(screen.getByText("Cancel"));

    await screen.findByText("Start Rendering", undefined, { timeout: 10_000 });
    await waitFor(() =>
      expect(preview.style.transform).toContain("0.466667")
    );
  });

  it("auto-retries via html2canvas after a frame-0 snapdom failure", async () => {
    snapdomMock.toCanvas.mockRejectedValueOnce(new Error("SVG rasterize broke"));
    useVideoStore.getState().setMarkdown("!scene\n!duration 0.5\n!text\nHi\n", false);
    const { ffmpeg } = renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));

    // The compatibility retry runs automatically — no error UI, no click.
    await screen.findByText("Your video is ready to download", undefined, {
      timeout: 15_000,
    });
    expect(screen.queryByText("Export Failed")).toBeNull();
    expect(
      sessionStorage.getItem("markdown-video:snapdom-capture-disabled")
    ).toBe("1");

    expect(snapdomMock.toCanvas).toHaveBeenCalledTimes(1);
    expect(html2canvasMock).toHaveBeenCalledTimes(15);
    const opts = (html2canvasMock.mock.calls[0] as unknown[] | undefined)?.[1] as {
      ignoreElements?: (el: Element) => boolean;
    };
    expect(typeof opts.ignoreElements).toBe("function");
    // The predicate keeps the preview subtree/ancestors/head styles and
    // ignores everything else.
    const preview = document.querySelector('[data-scene-preview="true"]')!;
    expect(opts.ignoreElements!(preview)).toBe(false);
    expect(opts.ignoreElements!(document.head)).toBe(false);
    const unrelated = document.createElement("div");
    document.body.appendChild(unrelated);
    expect(opts.ignoreElements!(unrelated)).toBe(true);
    // WebCodecs path: frames went to the encoder, not MEMFS files.
    expect(webcodecsMock.addFrame).toHaveBeenCalledTimes(15);
    expect(ffmpeg.exec).not.toHaveBeenCalled();
  });
  it("survives a cancel-then-restart race: run 2's layout wins and restores cleanly", async () => {
    useVideoStore
      .getState()
      .setMarkdown("!scene\n!duration 30\n!text\nHi\n", false);
    let resolveFirst: (() => void) | undefined;
    snapdomMock.toCanvas.mockImplementationOnce(
      (_el: unknown, opts: { canvas: unknown }) =>
        new Promise((resolve) => {
          resolveFirst = () =>
            resolve(
              Object.assign(opts.canvas as object, {
                toBlob: (cb: (b: Blob | null) => void) =>
                  cb(Object.assign(new Blob([new Uint8Array([1])]), {
                    arrayBuffer: async () => new Uint8Array([1]).buffer,
                  })),
              })
            );
        })
    );

    const { preview } = renderExport();
    const originalTransform = preview.style.transform;
    fireEvent.click(screen.getByText("Start Rendering"));
    await waitFor(() => expect(snapdomMock.toCanvas).toHaveBeenCalledTimes(1), {
      timeout: 10_000,
    });

    // Cancel run 1 while its first capture is still in flight, then start
    // run 2 immediately — run 2 applies its layout before run 1 finishes.
    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(await screen.findByText("Start Rendering"));
    await waitFor(() => expect(snapdomMock.toCanvas).toHaveBeenCalledTimes(2), {
      timeout: 10_000,
    });
    expect(preview.style.transform).toBe("none");

    // Run 1's capture resolves now; its finally must not restore over run 2.
    resolveFirst!();
    await new Promise((r) => setTimeout(r, 50));
    expect(preview.style.transform).toBe("none");
    expect(preview.style.width).toBe("1920px");

    // Cancelling run 2 restores the true pre-export styles.
    fireEvent.click(screen.getByText("Cancel"));
    await screen.findByText("Start Rendering", undefined, { timeout: 10_000 });
    await waitFor(() =>
      expect(preview.style.transform).toBe(originalTransform)
    );
    expect(preview.style.width).toBe("1920px");
  });

  it("proceeds after ~1s when rAF never fires while the tab is visible", async () => {
    useVideoStore
      .getState()
      .setMarkdown("!scene\n!duration 0.1\n!text\nHi\n", false);
    vi.stubGlobal("requestAnimationFrame", () => 1);
    renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));
    await waitFor(() => expect(snapdomMock.toCanvas).toHaveBeenCalled(), {
      timeout: 10_000,
    });
    vi.unstubAllGlobals();
  });

  it("keeps waiting on rAF while the tab is hidden", async () => {
    useVideoStore
      .getState()
      .setMarkdown("!scene\n!duration 0.5\n!text\nHi\n", false);
    vi.stubGlobal("requestAnimationFrame", () => 1);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));
    await new Promise((r) => setTimeout(r, 2500));
    expect(snapdomMock.toCanvas).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    delete (document as { visibilityState?: string }).visibilityState;
  });
});
