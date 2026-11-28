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
    createEncoder: vi.fn(),
    WebCodecsEncoderError,
  };
});

const audioMock = vi.hoisted(() => ({
  selectCodec: vi.fn(async () => "native" as "native" | "wasm" | null),
  renderBuffer: vi.fn(async () => ({ duration: 1 }) as unknown as AudioBuffer),
}));

vi.mock("@/components/video-editor/export-modal/utils/webcodecs-export", () => ({
  isWebCodecsExportSupported: webcodecsMock.isSupported,
  selectWebCodecsVideoConfig: webcodecsMock.selectConfig,
  createWebCodecsMp4Encoder: webcodecsMock.createEncoder,
  WebCodecsEncoderError: webcodecsMock.WebCodecsEncoderError,
}));

vi.mock("@/components/video-editor/export-modal/utils/webcodecs-audio", () => ({
  selectWebCodecsAudioCodec: audioMock.selectCodec,
  renderMusicAudioBuffer: audioMock.renderBuffer,
  WEBCODECS_AUDIO_BITRATE: 128000,
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

vi.mock("@zumer/snapdom", () => ({
  snapdom: {
    toCanvas: vi.fn(async (_el: unknown, opts: { canvas: unknown }) =>
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

const MUSIC_DOC =
  "!music https://example.com/theme.mp3 volume:1 loop:true\n!scene\n!duration 0.2\n!text\nHi\n";
const PLAIN_DOC = "!scene\n!duration 0.2\n!text\nHi\n";

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

function renderExport(
  ensureFFmpeg: () => Promise<unknown> = async () => createFfmpegMock()
) {
  const preview = document.createElement("div");
  preview.setAttribute("data-scene-preview", "true");
  document.body.appendChild(preview);
  render(<FfmpegRender ensureFFmpeg={ensureFFmpeg as never} />);
  return { preview };
}

async function completeExport(ensure?: () => Promise<unknown>) {
  renderExport(ensure);
  fireEvent.click(screen.getByText("Start Rendering"));
  await screen.findByText("Your video is ready to download", undefined, {
    timeout: 10_000,
  });
}

describe("FfmpegRender WebCodecs audio + lazy ffmpeg", () => {
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
    webcodecsMock.createEncoder.mockReturnValue({
      addFrame: webcodecsMock.addFrame,
      finalize: webcodecsMock.finalize,
      close: webcodecsMock.close,
    } as never);
  });

  afterEach(() => {
    cleanup();
    document.querySelectorAll("[data-scene-preview]").forEach((el) => el.remove());
    useVideoStore.getState().setMarkdown(originalMarkdown, false);
    webcodecsMock.addFrame.mockClear();
    webcodecsMock.finalize.mockClear();
    webcodecsMock.close.mockClear();
    webcodecsMock.selectConfig.mockClear();
    webcodecsMock.createEncoder.mockClear();
    webcodecsMock.selectConfig.mockResolvedValue({ codec: "avc1.640028" } as never);
    webcodecsMock.isSupported.mockReturnValue(true);
    audioMock.selectCodec.mockClear();
    audioMock.selectCodec.mockResolvedValue("native");
    audioMock.renderBuffer.mockClear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("(a) muxes music through the encoder and never loads ffmpeg", async () => {
    useVideoStore.getState().setMarkdown(MUSIC_DOC, false);
    const ensureFFmpeg = vi.fn(async () => createFfmpegMock());
    await completeExport(ensureFFmpeg);

    expect(ensureFFmpeg).not.toHaveBeenCalled();
    expect(audioMock.renderBuffer).toHaveBeenCalledTimes(1);
    const options = webcodecsMock.createEncoder.mock.calls[0]?.[0] as {
      audio?: { buffer: AudioBuffer; bitrate: number };
    };
    expect(options.audio?.bitrate).toBe(128000);
    expect(options.audio?.buffer).toBeTruthy();
  });

  it("(b) falls back to the ffmpeg remux when no AAC encoder is available", async () => {
    audioMock.selectCodec.mockResolvedValue(null);
    useVideoStore.getState().setMarkdown(MUSIC_DOC, false);
    const ffmpeg = createFfmpegMock();
    const ensureFFmpeg = vi.fn(async () => ffmpeg);
    await completeExport(ensureFFmpeg);

    expect(ensureFFmpeg).toHaveBeenCalledTimes(1);
    expect(ffmpeg.exec).toHaveBeenCalledTimes(1);
    const argv = (ffmpeg.exec.mock.calls[0]?.[0] ?? []).map(String);
    expect(argv).toContain("-c:v");
    expect(argv).toContain("copy");
  });

  it("(c) loads ffmpeg on demand for a GIF export", async () => {
    useVideoStore.getState().setMarkdown(PLAIN_DOC, false);
    useVideoStore.setState((state) => ({
      exportSettings: { ...state.exportSettings, format: "gif" },
    }));
    const ffmpeg = createFfmpegMock();
    const ensureFFmpeg = vi.fn(async () => ffmpeg);
    await completeExport(ensureFFmpeg);
    expect(ensureFFmpeg).toHaveBeenCalledTimes(1);
    expect(ffmpeg.exec).toHaveBeenCalled();
  });

  it("(d) Start Rendering is enabled before any ffmpeg load", () => {
    useVideoStore.getState().setMarkdown(PLAIN_DOC, false);
    const ensureFFmpeg = vi.fn(async () => createFfmpegMock());
    renderExport(ensureFFmpeg);
    const start = screen.getByText("Start Rendering");
    expect((start as HTMLButtonElement).disabled).toBe(false);
    expect(ensureFFmpeg).not.toHaveBeenCalled();
  });

  it("(e) cancel while ensureFFmpeg is pending returns to idle with no exec", async () => {
    useVideoStore.getState().setMarkdown(MUSIC_DOC, false);
    audioMock.selectCodec.mockResolvedValue(null);
    const resolveLoadRef: { current: ((value: unknown) => void) | null } = {
      current: null,
    };
    const ffmpeg = createFfmpegMock();
    const ensureFFmpeg = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          resolveLoadRef.current = resolve;
        })
    );
    renderExport(ensureFFmpeg);
    fireEvent.click(screen.getByText("Start Rendering"));
    await screen.findByText("Preparing… · Loading compatibility encoder");

    fireEvent.click(screen.getByText("Cancel"));
    await screen.findByText("Start Rendering");

    resolveLoadRef.current?.(ffmpeg);
    await waitFor(() => expect(ffmpeg.exec).not.toHaveBeenCalled());
  });

  it("(f) the auto-retry legacy run loads ffmpeg on demand", async () => {
    useVideoStore.getState().setMarkdown(PLAIN_DOC, false);
    webcodecsMock.addFrame.mockRejectedValueOnce(
      new webcodecsMock.WebCodecsEncoderError("encoder died")
    );
    const ffmpeg = createFfmpegMock();
    const ensureFFmpeg = vi.fn(async () => ffmpeg);
    await completeExport(ensureFFmpeg);

    expect(ensureFFmpeg).toHaveBeenCalledTimes(1);
    expect(ffmpeg.exec).toHaveBeenCalled();
  });
});
