"use client";

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  X,
  Film,
} from "lucide-react";
import { toast } from "sonner";
import { useVideoStore } from "@/lib/use-video-store";
import {
  EXPORT_EVENT_NAMES,
  buildExportEventProperties,
  isCancellationError,
  trackExportEvent,
} from "@/lib/analytics";
import {
  buildMusicAudioFilter,
  buildMusicInputArgs,
  buildMusicOutputArgs,
  createRenderPlan,
  generateCaptionSidecars,
  getFrameFileName,
  getVideoEncodingSettings,
  validateExportInput,
} from "@markdown-video/core";
import {
  RenderRunTracker,
  applyRenderLayoutToClone,
  copyFrameData,
  getExportArtifactNames,
} from "../utils/export-utils";
import {
  fetchBrowserMusicData,
  fetchCaptionFontData,
} from "../utils/export-media";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface FileUploaderProps {
  loadFunction: () => Promise<void>;
  loadFfmpeg: boolean;
  ffmpeg: FFmpeg;
}

type RenderStatus =
  | "idle"
  | "preparing"
  | "capturing"
  | "encoding"
  | "complete"
  | "error";

type ActiveRun = {
  generation: number;
  controller: AbortController;
  phase: "preparing" | "capturing" | "encoding";
};

class RenderCancelledError extends Error {
  constructor() {
    super("Rendering cancelled");
    this.name = "RenderCancelledError";
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new RenderCancelledError());
      return;
    }

    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);

    function handleAbort() {
      clearTimeout(timeout);
      reject(new RenderCancelledError());
    }

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

export default function FfmpegRender({
  loadFunction,
  loadFfmpeg,
  ffmpeg,
}: FileUploaderProps) {
  const [status, setStatus] = useState<RenderStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [captionUrls, setCaptionUrls] = useState<{ srt: string; vtt: string } | null>(null);
  const [outputFileName, setOutputFileName] = useState("video.mp4");
  const [errorMessage, setErrorMessage] = useState("");

  const [runTracker] = useState(() => new RenderRunTracker());
  const activeRunRef = useRef<ActiveRun | null>(null);
  const mountedRef = useRef(true);
  const previewUrlRef = useRef<string | null>(null);
  const captionUrlsRef = useRef<{ srt: string; vtt: string } | null>(null);

  const totalDuration = useVideoStore((state) => state.totalDuration);
  const sceneCount = useVideoStore((state) => state.scenes.length);
  const exportSettings = useVideoStore((state) => state.exportSettings);
  const seekTo = useVideoStore((state) => state.seekTo);
  const pause = useVideoStore((state) => state.pause);

  const exportValidation = validateExportInput({
    sceneCount,
    totalDuration,
    fps: exportSettings.fps,
  });

  const replacePreviewUrl = useCallback((url: string | null) => {
    const previousUrl = previewUrlRef.current;
    if (previousUrl && previousUrl !== url) {
      URL.revokeObjectURL(previousUrl);
    }
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }, []);

  const replaceCaptionUrls = useCallback((urls: { srt: string; vtt: string } | null) => {
    const previousUrls = captionUrlsRef.current;
    if (previousUrls && previousUrls !== urls) {
      URL.revokeObjectURL(previousUrls.srt);
      URL.revokeObjectURL(previousUrls.vtt);
    }
    captionUrlsRef.current = urls;
    setCaptionUrls(urls);
  }, []);

  const resetRenderState = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setCurrentFrame(0);
    setTotalFrames(0);
    setErrorMessage("");
    replacePreviewUrl(null);
    replaceCaptionUrls(null);
  }, [replacePreviewUrl, replaceCaptionUrls]);

  const cancelActiveRun = useCallback(() => {
    const activeRun = activeRunRef.current;
    if (!activeRun) return false;

    activeRun.controller.abort();
    runTracker.cancelRun(activeRun.generation);
    activeRunRef.current = null;

    // During capture each write is small and abortable, so the loaded worker
    // can be reused. Encoding is long-running; terminating is the only way to
    // stop ffmpeg.wasm's CPU work promptly. Reloading is necessary only here.
    if (activeRun.phase === "encoding") {
      try {
        ffmpeg.terminate();
      } catch (error) {
        console.error("Failed to terminate FFmpeg:", error);
      }
      void loadFunction();
    }

    return true;
  }, [ffmpeg, loadFunction, runTracker]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      const activeRun = activeRunRef.current;
      if (activeRun) {
        activeRun.controller.abort();
        runTracker.cancelRun(activeRun.generation);
        activeRunRef.current = null;

        // The parent intentionally keeps an idle worker warm across modal
        // closes, so encoding must be stopped here before it can continue as
        // detached CPU work in that reusable worker.
        if (activeRun.phase === "encoding") {
          try {
            ffmpeg.terminate();
          } catch {
            // Termination is best-effort during unmount.
          }
        }
      }

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      if (captionUrlsRef.current) {
        URL.revokeObjectURL(captionUrlsRef.current.srt);
        URL.revokeObjectURL(captionUrlsRef.current.vtt);
        captionUrlsRef.current = null;
      }
    };
  }, [ffmpeg, runTracker]);

  const handleReset = () => {
    cancelActiveRun();
    resetRenderState();
  };

  const render = async () => {
    if (!loadFfmpeg) {
      toast.error("FFmpeg is not loaded yet");
      return;
    }

    if (!exportValidation.valid) {
      toast.error(exportValidation.reason ?? "Export is not available");
      return;
    }

    if (activeRunRef.current) {
      return;
    }

    // Find the scene preview element
    const previewElement = document.querySelector(
      '[data-scene-preview="true"]'
    ) as HTMLElement;
    if (!previewElement) {
      toast.error(
        "Scene preview not found. Please ensure the preview is visible."
      );
      return;
    }

    const generation = runTracker.beginRun();
    const controller = new AbortController();
    const activeRun: ActiveRun = {
      generation,
      controller,
      phase: "preparing",
    };
    activeRunRef.current = activeRun;

    const isCurrentRun = () =>
      mountedRef.current &&
      !controller.signal.aborted &&
      runTracker.isCurrent(generation);

    const throwIfNotCurrent = () => {
      if (!isCurrentRun()) {
        throw new RenderCancelledError();
      }
    };

    setStatus("preparing");
    setProgress(0);
    setCurrentFrame(0);
    setTotalFrames(0);
    setErrorMessage("");
    replacePreviewUrl(null);
    replaceCaptionUrls(null);

    // The render plan and output parameters are pure functions of the
    // current settings, so computing them before the run starts lets the
    // analytics payload and the pipeline share one set of values.
    const state = useVideoStore.getState();
    const renderPlan = createRenderPlan({
      resolution: exportSettings.resolution,
      projectAspectRatio: state.aspectRatio,
      format: exportSettings.format,
      quality: exportSettings.quality,
    });
    const outputFps = exportValidation.outputFps;
    const totalFrameCount = exportValidation.totalFrameCount;
    const format = exportSettings.format || "mp4";
    const artifactNames = getExportArtifactNames(generation, format);
    const captionSidecars = generateCaptionSidecars(
      {
        scenes: state.scenes,
        locales: state.locales,
        localizationStrings: state.localizationStrings,
        defaultLocale: state.defaultLocale,
      },
      { activeLocale: state.activeLocale }
    );
    const hasCaptions = captionSidecars.cues.length > 0;
    const burnCaptions = exportSettings.burnCaptions === true && hasCaptions;
    // GIF containers cannot carry audio. Music is intentionally ignored there
    // rather than silently producing an invalid or player-hostile file.
    const music = format === "gif" ? undefined : state.music;

    // Privacy-preserving usage analytics: export settings, output geometry,
    // and scene type counts only — never markdown, scene content, or URLs.
    const exportEventProperties = buildExportEventProperties({
      format,
      resolution: exportSettings.resolution,
      quality: exportSettings.quality,
      speed: exportSettings.speed,
      fps: outputFps,
      aspectRatio: renderPlan.aspectRatio,
      width: renderPlan.width,
      height: renderPlan.height,
      durationSeconds: totalDuration,
      totalFrames: totalFrameCount,
      scenes: state.scenes,
    });
    trackExportEvent(EXPORT_EVENT_NAMES.started, exportEventProperties);

    let frameDirectory = "";
    let frameExtension = "jpg";
    let framesAttempted = 0;

    try {
      // Ensure all fonts are loaded before capture
      await document.fonts.ready;
      throwIfNotCurrent();

      const html2canvas = (await import("html2canvas-pro")).default;
      throwIfNotCurrent();

      frameExtension = renderPlan.frameExtension;
      const params = getVideoEncodingSettings(
        exportSettings.quality,
        exportSettings.speed
      );

      setTotalFrames(totalFrameCount);

      frameDirectory = artifactNames.frameDirectory;
      await ffmpeg.createDir(frameDirectory, { signal: controller.signal });
      throwIfNotCurrent();

      if (music) {
        const musicData = await fetchBrowserMusicData(music.src, controller.signal);
        throwIfNotCurrent();
        await ffmpeg.writeFile(artifactNames.musicFileName, musicData, {
          signal: controller.signal,
        });
        throwIfNotCurrent();
      }

      if (burnCaptions) {
        await ffmpeg.writeFile(
          artifactNames.captionsFileName,
          new TextEncoder().encode(captionSidecars.srt),
          { signal: controller.signal }
        );
        await ffmpeg.createDir(artifactNames.fontDirectory, { signal: controller.signal });
        const fontData = await fetchCaptionFontData(controller.signal);
        throwIfNotCurrent();
        await ffmpeg.writeFile(
          `${artifactNames.fontDirectory}/${artifactNames.fontFileName}`,
          fontData,
          { signal: controller.signal }
        );
        throwIfNotCurrent();
      }

      // Pause playback and seek to start
      pause();
      seekTo(0);
      await sleep(500, controller.signal);
      throwIfNotCurrent();

      activeRun.phase = "capturing";
      setStatus("capturing");

      let lastFrame: Uint8Array | null = null;
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = renderPlan.width;
      frameCanvas.height = renderPlan.height;
      const frameContext = frameCanvas.getContext("2d");
      if (!frameContext) {
        throw new Error("Could not get 2D context");
      }

      for (let frameIndex = 0; frameIndex < totalFrameCount; frameIndex++) {
        throwIfNotCurrent();
        framesAttempted = frameIndex + 1;

        const currentTime = frameIndex / outputFps;
        seekTo(Math.min(currentTime, totalDuration));

        // Scenes render from sceneTime, so a frame is ready once React has
        // committed and effects have run. A few animation frames cover that;
        // a fixed sleep here only added 100 ms to every frame.
        for (let i = 0; i < 3; i++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          throwIfNotCurrent();
        }

        try {
          // html2canvas reuses this exact-size canvas. Resetting the transform
          // is required because the renderer leaves its scale/translate behind.
          frameContext.setTransform(1, 0, 0, 1, 0, 0);
          frameContext.clearRect(0, 0, renderPlan.width, renderPlan.height);

          const capturedCanvas = await html2canvas(previewElement, {
            canvas: frameCanvas,
            backgroundColor: "#000000",
            scale: renderPlan.captureScale,
            logging: false,
            useCORS: true,
            allowTaint: true,
            removeContainer: true,
            imageTimeout: 0,
            width: renderPlan.layoutWidth,
            height: renderPlan.layoutHeight,
            windowWidth: renderPlan.layoutWidth,
            windowHeight: Math.ceil(renderPlan.layoutHeight),
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc, clonedElement) => {
              const applied = applyRenderLayoutToClone({
                clonedDoc,
                clonedElement: clonedElement as HTMLElement | null,
                renderPlan,
              });

              if (!applied) {
                throw new Error("Scene preview missing in export clone");
              }
            },
          });
          throwIfNotCurrent();

          const blob = await new Promise<Blob>((resolve, reject) => {
            capturedCanvas.toBlob(
              (b) => {
                if (b) resolve(b);
                else reject(new Error("Failed to create frame blob"));
              },
              renderPlan.frameMimeType,
              renderPlan.frameQuality
            );
          });
          throwIfNotCurrent();

          const arrayBuffer = await blob.arrayBuffer();
          const frameData = new Uint8Array(arrayBuffer);
          // writeFile transfers (and therefore empties) frameData.buffer.
          // Keep an independent copy for the repeat-last-frame fallback.
          const fallbackFrame = copyFrameData(frameData);
          const fileName = getFrameFileName(
            frameIndex,
            renderPlan.frameExtension
          );
          await ffmpeg.writeFile(
            `${frameDirectory}/${fileName}`,
            frameData,
            { signal: controller.signal }
          );
          lastFrame = fallbackFrame;
        } catch (error) {
          if (!isCurrentRun()) {
            throw new RenderCancelledError();
          }

          console.error(`Failed to capture frame ${frameIndex}:`, error);
          // FFmpeg's image sequence input stops at the first missing file, so a
          // gap would silently cut the video short. Repeat the previous frame.
          if (!lastFrame) {
            throw new Error("Could not capture the first frame");
          }
          const fileName = getFrameFileName(
            frameIndex,
            renderPlan.frameExtension
          );
          // Copy again: writeFile would otherwise neuter lastFrame on the
          // first fallback write and every later fallback would be empty.
          await ffmpeg.writeFile(
            `${frameDirectory}/${fileName}`,
            copyFrameData(lastFrame),
            { signal: controller.signal }
          );
        }

        throwIfNotCurrent();
        setCurrentFrame(frameIndex + 1);
        setProgress(Math.round(((frameIndex + 1) / totalFrameCount) * 100));
      }

      throwIfNotCurrent();
      activeRun.phase = "encoding";
      setStatus("encoding");
      setProgress(0);

      let outputBlob: Blob;
      let nextOutputFileName: string;
      const inputPattern = `${frameDirectory}/${renderPlan.inputPattern}`;

      const execFfmpeg = async (args: string[], description: string) => {
        const exitCode = await ffmpeg.exec(args, -1, {
          signal: controller.signal,
        });
        throwIfNotCurrent();
        if (exitCode !== 0) {
          throw new Error(`${description} failed with exit code ${exitCode}`);
        }
      };

      if (format === "gif") {
        // Reduce FPS for GIF to keep file size small (max 10fps for GIFs)
        const gifFps = Math.min(outputFps, 10);

        // Generate palette first for better compression
        const paletteArgs = [
          "-v",
          "error",
          "-framerate",
          String(outputFps),
          "-i",
          inputPattern,
          "-vf",
          `fps=${gifFps},palettegen=max_colors=64`,
          "-y",
          artifactNames.paletteFileName,
        ];

        await execFfmpeg(paletteArgs, "GIF palette generation");

        // Encode GIF using the palette with aggressive dithering
        const gifArgs = [
          "-v",
          "error",
          "-framerate",
          String(outputFps),
          "-i",
          inputPattern,
          "-i",
          artifactNames.paletteFileName,
          "-lavfi",
          `fps=${gifFps}${burnCaptions ? `,subtitles=${artifactNames.captionsFileName}:fontsdir=${artifactNames.fontDirectory}` : ""}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=2`,
          "-loop",
          "0",
          "-y",
          artifactNames.outputFileName,
        ];

        await execFfmpeg(gifArgs, "GIF encoding");
        const gifData = await ffmpeg.readFile(
          artifactNames.outputFileName,
          "binary",
          {
            signal: controller.signal,
          }
        );
        throwIfNotCurrent();
        outputBlob = new Blob([gifData as BlobPart], { type: "image/gif" });
        nextOutputFileName = "video.gif";
      } else {
        // MP4 is used for mp4, reels and shorts. The dimensions in
        // renderPlan already encode the selected aspect ratio.
        const subtitlesFilter = `subtitles=${artifactNames.captionsFileName}:fontsdir=${artifactNames.fontDirectory}`;
        const mp4Args = [
          "-v",
          "error",
          "-framerate",
          String(outputFps),
          "-i",
          inputPattern,
          ...(music ? buildMusicInputArgs(music, artifactNames.musicFileName) : []),
          ...(music
            ? buildMusicOutputArgs(buildMusicAudioFilter(music, totalDuration))
            : []),
          ...(burnCaptions ? ["-vf", subtitlesFilter] : []),
          "-c:v",
          "libx264",
          "-preset",
          params.preset,
          "-crf",
          String(params.crf),
          "-pix_fmt",
          "yuv420p",
          "-t",
          totalDuration.toFixed(3),
          artifactNames.outputFileName,
        ];

        await execFfmpeg(mp4Args, "MP4 encoding");
        const mp4Data = await ffmpeg.readFile(
          artifactNames.outputFileName,
          "binary",
          {
            signal: controller.signal,
          }
        );
        throwIfNotCurrent();
        outputBlob = new Blob([mp4Data as BlobPart], { type: "video/mp4" });
        nextOutputFileName = "video.mp4";
      }

      throwIfNotCurrent();
      if (hasCaptions) {
        const srtUrl = URL.createObjectURL(
          new Blob([captionSidecars.srt], { type: "application/x-subrip" })
        );
        const vttUrl = URL.createObjectURL(
          new Blob([captionSidecars.vtt], { type: "text/vtt" })
        );
        if (!isCurrentRun()) {
          URL.revokeObjectURL(srtUrl);
          URL.revokeObjectURL(vttUrl);
          throw new RenderCancelledError();
        }
        replaceCaptionUrls({ srt: srtUrl, vtt: vttUrl });
      }

      const objectUrl = URL.createObjectURL(outputBlob);
      if (!isCurrentRun()) {
        URL.revokeObjectURL(objectUrl);
        throw new RenderCancelledError();
      }

      replacePreviewUrl(objectUrl);
      setOutputFileName(nextOutputFileName);
      setStatus("complete");
      trackExportEvent(EXPORT_EVENT_NAMES.finished, exportEventProperties);
      toast.success(`${format.toUpperCase()} exported successfully!`);
    } catch (err) {
      const wasCancelled =
        isCancellationError(err) ||
        controller.signal.aborted ||
        !runTracker.isCurrent(generation);

      // Cancellation is a distinct user action, never a failure. The phase
      // is safe metadata: a fixed enum of pipeline stage names.
      if (wasCancelled) {
        trackExportEvent(EXPORT_EVENT_NAMES.cancelled, {
          ...exportEventProperties,
          phase: activeRun.phase,
        });
      } else {
        trackExportEvent(EXPORT_EVENT_NAMES.failed, {
          ...exportEventProperties,
          phase: activeRun.phase,
        });
        const message =
          err instanceof Error ? err.message : "Failed to render video";
        setErrorMessage(message);
        setStatus("error");
        toast.error(message);
        console.error("Failed to render video:", err);
      }
    } finally {
      if (activeRunRef.current === activeRun) {
        activeRunRef.current = null;
      }

      // Frames, palettes, and encoded outputs are all generation-specific,
      // so this asynchronous cleanup cannot delete artifacts belonging to a
      // newer render. If the worker was terminated the MEMFS is already gone;
      // errors are ignored.
      const directoryToClean = frameDirectory;
      const frameCountToClean = framesAttempted;
      if (directoryToClean && ffmpeg.loaded) {
        void (async () => {
          for (let frameIndex = 0; frameIndex < frameCountToClean; frameIndex++) {
            try {
              await ffmpeg.deleteFile(
                `${directoryToClean}/${getFrameFileName(frameIndex, frameExtension)}`
              );
            } catch {
              // Ignore missing files and cleanup races.
            }
          }
          try {
            await ffmpeg.deleteFile(artifactNames.paletteFileName);
          } catch {}
          try {
            await ffmpeg.deleteFile(artifactNames.outputFileName);
          } catch {}
          try {
            await ffmpeg.deleteFile(artifactNames.musicFileName);
          } catch {}
          try {
            await ffmpeg.deleteFile(artifactNames.captionsFileName);
          } catch {}
          try {
            await ffmpeg.deleteFile(
              `${artifactNames.fontDirectory}/${artifactNames.fontFileName}`
            );
          } catch {}
          try {
            await ffmpeg.deleteDir(artifactNames.fontDirectory);
          } catch {}
          try {
            await ffmpeg.deleteDir(directoryToClean);
          } catch {}
        })();
      }
    }
  };

  // Render button when idle
  if (status === "idle") {
    return (
      <div className="space-y-2">
        <Button
          onClick={render}
          disabled={!loadFfmpeg || !exportValidation.valid}
          className="w-full gap-2 bg-pink-500 hover:bg-pink-600 text-white"
        >
          {!loadFfmpeg ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading FFmpeg...
            </>
          ) : (
            <>
              <Film className="w-4 h-4" />
              Start Rendering
            </>
          )}
        </Button>
        {!exportValidation.valid && exportValidation.reason && (
          <p role="alert" className="text-xs text-amber-400 text-center">
            {exportValidation.reason}
          </p>
        )}
      </div>
    );
  }

  // Capturing/Encoding progress
  if (
    status === "preparing" ||
    status === "capturing" ||
    status === "encoding"
  ) {
    return (
      <div className="py-6 space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-medium">
              {status === "preparing" && "Preparing..."}
              {status === "capturing" && "Capturing frames..."}
              {status === "encoding" && "Encoding video..."}
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              {status === "capturing" && `Frame ${currentFrame}/${totalFrames}`}
              {status === "encoding" && "Almost done..."}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="h-2 bg-zinc-800" />
          <p className="text-xs text-zinc-500 text-center">{progress}%</p>
        </div>

        <Button
          onClick={handleReset}
          variant="outline"
          className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 bg-transparent"
        >
          Cancel
        </Button>
      </div>
    );
  }

  // Complete state
  if (status === "complete" && previewUrl) {
    return (
      <div className="py-6 space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-medium">Export Complete!</p>
            <p className="text-sm text-zinc-400 mt-1">
              Your video is ready to download
            </p>
          </div>
        </div>

        {/* Preview based on format */}
        <div className="rounded-lg overflow-hidden border border-zinc-700">
          {exportSettings.format === "gif" ? (
            <img
              src={previewUrl}
              alt="GIF Preview"
              className="w-full"
              style={{ maxHeight: "300px" }}
            />
          ) : (
            <video
              src={previewUrl}
              controls
              className="w-full"
              style={{ maxHeight: "300px" }}
            />
          )}
        </div>

        <div className="flex gap-3">
          <Button
            asChild
            className="flex-1 gap-2 bg-pink-500 hover:bg-pink-600 text-white"
          >
            <a href={previewUrl} download={outputFileName}>
              <Download className="w-4 h-4" />
              Download {exportSettings.format === "gif" ? "GIF" : "Video"}
            </a>
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 bg-transparent"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {captionUrls && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 text-center">
              Caption sidecars generated from text scenes
            </p>
            <div className="flex gap-3">
              <Button
                asChild
                variant="outline"
                className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800 bg-transparent"
              >
                <a href={captionUrls.srt} download="video.srt">
                  <Download className="w-4 h-4" />
                  SRT
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800 bg-transparent"
              >
                <a href={captionUrls.vtt} download="video.vtt">
                  <Download className="w-4 h-4" />
                  VTT
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="py-6 space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-medium">Export Failed</p>
            <p className="text-sm text-red-400 mt-1">{errorMessage}</p>
          </div>
        </div>

        <Button
          onClick={handleReset}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return null;
}
