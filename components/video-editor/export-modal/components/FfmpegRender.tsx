"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Download, X, Film } from "lucide-react";
import { toast } from "sonner";
import { useVideoStore } from "@/lib/use-video-store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface FileUploaderProps {
  loadFunction: () => Promise<void>;
  loadFfmpeg: boolean;
  ffmpeg: FFmpeg;
  logMessages: string;
}

type RenderStatus = "idle" | "preparing" | "capturing" | "encoding" | "complete" | "error";

const getQualitySettings = (quality: string, speed: string) => {
  const qualityMap: Record<
    string,
    Record<string, { preset: string; crf: number }>
  > = {
    low: {
      fastest: { preset: "ultrafast", crf: 28 },
      fast: { preset: "superfast", crf: 26 },
      balanced: { preset: "fast", crf: 28 },
      slow: { preset: "medium", crf: 28 },
      slowest: { preset: "slow", crf: 28 },
    },
    medium: {
      fastest: { preset: "superfast", crf: 23 },
      fast: { preset: "fast", crf: 23 },
      balanced: { preset: "medium", crf: 23 },
      slow: { preset: "slow", crf: 23 },
      slowest: { preset: "slower", crf: 23 },
    },
    high: {
      fastest: { preset: "fast", crf: 18 },
      fast: { preset: "medium", crf: 18 },
      balanced: { preset: "slow", crf: 18 },
      slow: { preset: "slower", crf: 18 },
      slowest: { preset: "veryslow", crf: 18 },
    },
    ultra: {
      fastest: { preset: "medium", crf: 15 },
      fast: { preset: "slow", crf: 15 },
      balanced: { preset: "slower", crf: 15 },
      slow: { preset: "veryslow", crf: 15 },
      slowest: { preset: "veryslow", crf: 12 },
    },
  };
  return qualityMap[quality]?.[speed] || qualityMap.high.balanced;
};

const getResolutionDimensions = (resolution: string) => {
  const resMap: Record<string, { width: number; height: number }> = {
    "480p": { width: 854, height: 480 },
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 },
  };
  return resMap[resolution] || resMap["1080p"];
};

export default function FfmpegRender({
  loadFunction,
  loadFfmpeg,
  ffmpeg,
  logMessages,
}: FileUploaderProps) {
  const [status, setStatus] = useState<RenderStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const cancelledRef = useRef(false);

  const totalDuration = useVideoStore((state) => state.totalDuration);
  const exportSettings = useVideoStore((state) => state.exportSettings);
  const seekTo = useVideoStore((state) => state.seekTo);
  const pause = useVideoStore((state) => state.pause);
  const projectName = "My Video";

  const handleReset = async () => {
    cancelledRef.current = true;
    setStatus("idle");
    setProgress(0);
    setCurrentFrame(0);
    setTotalFrames(0);
    setPreviewUrl(null);
    setErrorMessage("");
    try {
      ffmpeg.terminate();
      await loadFunction();
    } catch (e) {
      console.error("Failed to reset FFmpeg:", e);
    }
  };

  const render = async () => {
    if (!loadFfmpeg) {
      toast.error("FFmpeg is not loaded yet");
      return;
    }

    // Find the scene preview element
    const previewElement = document.querySelector('[data-scene-preview="true"]') as HTMLElement;
    if (!previewElement) {
      toast.error("Scene preview not found. Please ensure the preview is visible.");
      return;
    }

    setStatus("preparing");
    setProgress(0);
    setErrorMessage("");
    cancelledRef.current = false;

    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const dimensions = getResolutionDimensions(exportSettings.resolution);
      const params = getQualitySettings(
        exportSettings.quality,
        exportSettings.speed
      );

      // Frame rate for capture
      const fps = 15;
      const totalFrameCount = Math.ceil(totalDuration * fps);
      setTotalFrames(totalFrameCount);

      // Pause playback and seek to start
      pause();
      seekTo(0);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setStatus("capturing");

      for (let frameIndex = 0; frameIndex < totalFrameCount; frameIndex++) {
        if (cancelledRef.current) break;

        const currentTime = frameIndex / fps;
        seekTo(Math.min(currentTime, totalDuration));

        // Wait for DOM to update
        await new Promise((resolve) => setTimeout(resolve, 80));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        try {
          // Capture the frame using html2canvas with onclone to resize exactly to target resolution
          const capturedCanvas = await html2canvas(previewElement, {
            backgroundColor: null,
            scale: 1,
            width: dimensions.width,
            height: dimensions.height,
            logging: false,
            useCORS: true,
            allowTaint: true,
            removeContainer: true, // Important to prevent some offset issues
            imageTimeout: 0,
            onclone: (clonedDoc) => {
              const clonedElement = clonedDoc.querySelector('[data-scene-preview="true"]') as HTMLElement;
              if (clonedElement) {
                // Force the cloned element to the exact output resolution
                // This ensures high quality text and proper layout without L-shapes
                clonedElement.style.transform = 'none';
                clonedElement.style.width = `${dimensions.width}px`;
                clonedElement.style.height = `${dimensions.height}px`;
                clonedElement.style.maxWidth = 'none';
                clonedElement.style.maxHeight = 'none';
                clonedElement.style.borderRadius = '0'; // Clean edges for video
                clonedElement.style.boxShadow = 'none'; // Remove shadows for flat video

                // Also ensure all children fit
                const wrapper = clonedElement.querySelector('div');
                if (wrapper) {
                  wrapper.style.width = '100%';
                  wrapper.style.height = '100%';
                }
              }
            }
          });

          // Create output canvas
          const outputCanvas = document.createElement("canvas");
          outputCanvas.width = dimensions.width;
          outputCanvas.height = dimensions.height;
          const ctx = outputCanvas.getContext("2d");

          if (ctx) {
            // Draw the captured frame directly - it should match dimensions now
            ctx.drawImage(capturedCanvas, 0, 0);

            // Convert to PNG data
            const blob = await new Promise<Blob>((resolve, reject) => {
              outputCanvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error("Failed to create blob"));
              }, "image/png");
            });

            const arrayBuffer = await blob.arrayBuffer();
            const frameData = new Uint8Array(arrayBuffer);

            // Write frame to FFmpeg filesystem
            const frameName = `frame${String(frameIndex).padStart(5, "0")}.png`;
            await ffmpeg.writeFile(frameName, frameData);
          }
        } catch (error) {
          console.error(`Failed to capture frame ${frameIndex}:`, error);
        }

        setCurrentFrame(frameIndex + 1);
        setProgress(Math.round(((frameIndex + 1) / totalFrameCount) * 100));
      }

      if (cancelledRef.current) {
        throw new Error("Rendering cancelled");
      }

      setStatus("encoding");
      setProgress(0);

      // Use FFmpeg to encode frames to MP4
      const ffmpegArgs = [
        "-framerate", String(fps),
        "-i", "frame%05d.png",
        "-c:v", "libx264",
        "-preset", params.preset,
        "-crf", String(params.crf),
        "-pix_fmt", "yuv420p",
        "-t", totalDuration.toFixed(3),
        "output.mp4"
      ];

      await ffmpeg.exec(ffmpegArgs);

      // Read the output file
      const outputData = await ffmpeg.readFile("output.mp4");
      const outputBlob = new Blob([outputData as BlobPart], {
        type: "video/mp4",
      });

      // Clean up frame files
      for (let frameIndex = 0; frameIndex < totalFrameCount; frameIndex++) {
        try {
          const frameName = `frame${String(frameIndex).padStart(5, "0")}.png`;
          await ffmpeg.deleteFile(frameName);
        } catch {
          // Ignore cleanup errors
        }
      }

      setPreviewUrl(URL.createObjectURL(outputBlob));
      setStatus("complete");
      toast.success("Video rendered successfully!");

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to render video";
      if (message !== "Rendering cancelled") {
        setErrorMessage(message);
        setStatus("error");
        toast.error(message);
        console.error("Failed to render video:", err);
      } else {
        setStatus("idle");
      }
    }
  };

  // Render button when idle
  if (status === "idle") {
    return (
      <Button
        onClick={render}
        disabled={!loadFfmpeg}
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
    );
  }

  // Capturing/Encoding progress
  if (status === "preparing" || status === "capturing" || status === "encoding") {
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
            <p className="text-sm text-zinc-400 mt-1">Your video is ready to download</p>
          </div>
        </div>

        {/* Video preview */}
        <div className="rounded-lg overflow-hidden border border-zinc-700">
          <video
            src={previewUrl}
            controls
            className="w-full"
            style={{ maxHeight: "300px" }}
          />
        </div>

        <div className="flex gap-3">
          <Button
            asChild
            className="flex-1 gap-2 bg-pink-500 hover:bg-pink-600 text-white"
          >
            <a href={previewUrl} download={`${projectName}.mp4`}>
              <Download className="w-4 h-4" />
              Download Video
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
