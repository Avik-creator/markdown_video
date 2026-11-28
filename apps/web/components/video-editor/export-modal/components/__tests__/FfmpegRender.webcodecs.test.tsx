// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useVideoStore } from "@/lib/use-video-store";
import FfmpegRender from "../FfmpegRender";

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

vi.mock("html2canvas-pro", () => ({
  default: vi.fn(async () => ({
    toBlob: (callback: (blob: Blob | null) => void) =>
      // jsdom's Blob lacks arrayBuffer(), which the frame-write path needs.
      callback(
        Object.assign(new Blob([new Uint8Array([1])]), {
          arrayBuffer: async () => new Uint8Array([1]).buffer,
        })
      ),
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
  document.body.appendChild(preview);
  render(
    <FfmpegRender
      loadFunction={vi.fn(async () => {})}
      loadFfmpeg={true}
      ffmpeg={ffmpeg as never}
    />
  );
  return { ffmpeg, preview };
}

async function completeExport(ffmpeg = createFfmpegMock()) {
  const result = renderExport(ffmpeg);
  fireEvent.click(screen.getByText("Start Rendering"));
  await screen.findByText("Your video is ready to download", undefined, {
    timeout: 10_000,
  });
  return result;
}

describe("FfmpegRender WebCodecs path", () => {
  beforeEach(() => {
    if (!document.fonts) {
      Object.defineProperty(document, "fonts", {
        configurable: true,
        value: { ready: Promise.resolve() },
      });
    }
    // jsdom canvases have no 2D context; the pipeline only needs these calls
    // before html2canvas is replaced by the mock above.
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
    document.querySelectorAll("[data-scene-preview]").forEach((el) => el.remove());
    useVideoStore.getState().setMarkdown(originalMarkdown, false);
    webcodecsMock.addFrame.mockClear();
    webcodecsMock.finalize.mockClear();
    webcodecsMock.close.mockClear();
    webcodecsMock.selectConfig.mockClear();
    webcodecsMock.selectConfig.mockResolvedValue({ codec: "avc1.640028" } as never);
    webcodecsMock.isSupported.mockReturnValue(true);
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("feeds every frame to the encoder in order and writes no frame files", async () => {
    useVideoStore.getState().setMarkdown("!scene\n!duration 0.5\n!text\nHi\n", false);
    const { ffmpeg } = await completeExport();

    const frameIndexes = webcodecsMock.addFrame.mock.calls.map(([, i]) => i);
    expect(frameIndexes).toHaveLength(15);
    expect(frameIndexes).toEqual([...Array(15).keys()]);
    expect(webcodecsMock.finalize).toHaveBeenCalledTimes(1);
    const writtenPaths = ffmpeg.writeFile.mock.calls.map(([path]) => String(path));
    expect(writtenPaths.filter((path) => /frame\d{5}/.test(path))).toHaveLength(0);
    expect(ffmpeg.exec).not.toHaveBeenCalled();
  });

  it("remuxes once with -c:v copy when the document has music", async () => {
    useVideoStore
      .getState()
      .setMarkdown(
        "!music https://example.com/theme.mp3 volume:1 loop:true\n!scene\n!duration 0.2\n!text\nHi\n",
        false
      );
    const { ffmpeg } = await completeExport();

    expect(ffmpeg.exec).toHaveBeenCalledTimes(1);
    const argv = (ffmpeg.exec.mock.calls[0]?.[0] ?? []).map(String);
    expect(argv).toContain("-c:v");
    expect(argv).toContain("copy");
    const writtenPaths = ffmpeg.writeFile.mock.calls.map(([path]) => String(path));
    expect(writtenPaths.some((path) => path.includes("webcodecs-video-"))).toBe(true);
    expect(writtenPaths.filter((path) => /frame\d{5}/.test(path))).toHaveLength(0);
  });

  it("falls back to frame files and libx264 when no WebCodecs config is available", async () => {
    webcodecsMock.selectConfig.mockResolvedValue(null as never);
    useVideoStore.getState().setMarkdown("!scene\n!duration 0.2\n!text\nHi\n", false);
    const { ffmpeg } = await completeExport();

    expect(webcodecsMock.addFrame).not.toHaveBeenCalled();
    const writtenPaths = ffmpeg.writeFile.mock.calls.map(([path]) => String(path));
    expect(writtenPaths.some((path) => /frame\d{5}/.test(path))).toBe(true);
    expect(ffmpeg.exec).toHaveBeenCalledTimes(1);
    const argv = (ffmpeg.exec.mock.calls[0]?.[0] ?? []).map(String);
    expect(argv).toContain("libx264");
  });

  it("does not terminate ffmpeg when cancelled during WebCodecs capture", async () => {
    useVideoStore.getState().setMarkdown("!scene\n!duration 30\n!text\nHi\n", false);
    const { ffmpeg } = renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));

    await waitFor(() => expect(webcodecsMock.addFrame).toHaveBeenCalled(), {
      timeout: 10_000,
    });
    fireEvent.click(screen.getByText("Cancel"));

    await screen.findByText("Start Rendering", undefined, { timeout: 10_000 });
    expect(ffmpeg.terminate).not.toHaveBeenCalled();
  });


  it("falls back to the ffmpeg path after a runtime WebCodecs failure", async () => {
    webcodecsMock.addFrame.mockRejectedValue(
      new webcodecsMock.WebCodecsEncoderError(
        "WebCodecs H.264 encoder (avc1.640028) failed: EncodingError: GPU process crashed"
      )
    );
    useVideoStore.getState().setMarkdown("!scene\n!duration 0.5\n!text\nHi\n", false);
    const { ffmpeg } = renderExport();
    fireEvent.click(screen.getByText("Start Rendering"));

    await screen.findByText(/Hardware video encoding failed in this browser/, undefined, {
      timeout: 10_000,
    });
    expect(
      screen.getByText(/Try Again will use the compatibility encoder/)
    ).toBeTruthy();
    expect(sessionStorage.getItem("markdown-video:webcodecs-export-disabled")).toBe("1");

    // Try Again returns to idle; the next run never probes WebCodecs.
    fireEvent.click(screen.getByText("Try Again"));
    webcodecsMock.selectConfig.mockClear();
    webcodecsMock.addFrame.mockClear();
    const renderBtn = await screen.findByText("Start Rendering");
    fireEvent.click(renderBtn);
    await screen.findByText("Your video is ready to download", undefined, {
      timeout: 10_000,
    });

    expect(webcodecsMock.selectConfig).not.toHaveBeenCalled();
    expect(webcodecsMock.addFrame).not.toHaveBeenCalled();
    const writtenPaths = ffmpeg.writeFile.mock.calls.map(([path]) => String(path));
    expect(writtenPaths.some((path) => /frame\d{5}/.test(path))).toBe(true);
    const argv = (ffmpeg.exec.mock.calls[0]?.[0] ?? []).map(String);
    expect(argv).toContain("libx264");
  });
});
