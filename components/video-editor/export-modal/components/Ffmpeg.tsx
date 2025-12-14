"use client";

import { useEffect, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import FfmpegRender from "./FfmpegRender";
import RenderOptions from "./RenderOptions";
import { toast } from "sonner";

export default function Ffmpeg() {
  const [loadFfmpeg, setLoadedFfmpeg] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [logMessages, setLogMessages] = useState<string>("");

  const loadFFmpegFunction = async () => {
    try {
      setLoadedFfmpeg(false);
      console.log("Starting FFmpeg load...");

      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

      // Create new FFmpeg instance if not already created
      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
      }

      const ffmpeg = ffmpegRef.current;

      ffmpeg.on("log", ({ message }: { message: string }) => {
        console.log("FFmpeg log:", message);
        setLogMessages(message);
      });

      console.log("Loading FFmpeg core...");
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });

      console.log("FFmpeg loaded successfully");
      setLoadedFfmpeg(true);
      toast.success("FFmpeg loaded successfully");
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      toast.error("Failed to load FFmpeg");
      setLoadedFfmpeg(false);
    }
  };

  useEffect(() => {
    loadFFmpegFunction();
  }, []);

  return (
    <div className="flex flex-col justify-center items-center py-2">
      <RenderOptions />
      {ffmpegRef.current && (
        <FfmpegRender
          loadFunction={loadFFmpegFunction}
          loadFfmpeg={loadFfmpeg}
          logMessages={logMessages}
          ffmpeg={ffmpegRef.current}
        />
      )}
    </div>
  );
}
