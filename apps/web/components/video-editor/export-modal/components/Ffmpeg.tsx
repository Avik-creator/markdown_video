"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import FfmpegRender from "./FfmpegRender";
import RenderOptions from "./RenderOptions";
import { toast } from "sonner";
import {
  createWarmResourceLifecycle,
  type WarmResourceLease,
  type WarmResourceLifecycle,
} from "../utils/export-utils";

const FFMPEG_UMD_PATH = "/ffmpeg/control/ffmpeg.js";
const FFMPEG_WORKER_PATH = "/ffmpeg/worker/worker.js";
const FFMPEG_CORE_PATH = "/ffmpeg/core/ffmpeg-core.js";
const FFMPEG_WASM_PATH = "/ffmpeg/core/ffmpeg-core.wasm";

type FFmpegConstructor = new () => FFmpeg;
type FFmpegWindow = Window & {
  FFmpegWASM?: { FFmpeg?: FFmpegConstructor };
};

let ffmpegConstructorPromise: Promise<FFmpegConstructor> | null = null;

// Keep an idle ffmpeg core warm briefly across modal closes. The core is tens
// of megabytes and immutable after load, so re-fetching/recompiling it for
// every open is needlessly expensive. Reference counting allows overlapping
// consumers; once the last consumer disappears, a bounded idle timer
// terminates the worker so the optimization cannot become a permanent leak.
const FFMPEG_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
let ffmpegLifecycle: WarmResourceLifecycle<FFmpeg> | null = null;

function acquireFFmpegLease(
  FFmpegConstructor: FFmpegConstructor
): WarmResourceLease<FFmpeg> {
  if (!ffmpegLifecycle) {
    ffmpegLifecycle = createWarmResourceLifecycle<FFmpeg>({
      create: () => new FFmpegConstructor(),
      dispose: (instance) => {
        try {
          instance.terminate();
        } catch {
          // Disposal is best-effort; the worker may already be terminated.
        }
      },
      idleTimeoutMs: FFMPEG_IDLE_TIMEOUT_MS,
    });
  }

  return ffmpegLifecycle.acquire();
}

function sameOriginAssetUrl(path: string) {
  return new URL(path, window.location.origin).toString();
}

/**
 * Load the small ffmpeg.wasm control library from a same-origin static copy.
 * Importing the package ESM directly does not compile: its conditional
 * `new Worker(new URL(classWorkerURL, import.meta.url))` is not statically
 * analyzable by Turbopack and fails the production build. The control script,
 * module worker, core JS, and wasm are therefore copied verbatim at build time
 * from the lockfile-pinned `@ffmpeg/ffmpeg` and `@ffmpeg/core` packages by
 * `scripts/copy-ffmpeg-assets.mjs`. Once served from our own origin, the
 * script has no more authority than the application bundle itself.
 */
function loadFFmpegConstructor(): Promise<FFmpegConstructor> {
  const existing = (window as FFmpegWindow).FFmpegWASM?.FFmpeg;
  if (existing) return Promise.resolve(existing);

  if (!ffmpegConstructorPromise) {
    ffmpegConstructorPromise = new Promise<FFmpegConstructor>(
      (resolve, reject) => {
        const script = document.createElement("script");
        script.src = FFMPEG_UMD_PATH;
        script.async = true;
        script.onload = () => {
          const Constructor = (window as FFmpegWindow).FFmpegWASM?.FFmpeg;
          if (Constructor) resolve(Constructor);
          else reject(new Error("FFmpeg script loaded without its export"));
        };
        script.onerror = () => reject(new Error("Failed to load FFmpeg script"));
        document.head.appendChild(script);
      }
    ).catch((error: unknown) => {
      // A missing asset or failed parse should not poison later attempts.
      ffmpegConstructorPromise = null;
      throw error;
    });
  }
  return ffmpegConstructorPromise;
}

let ffmpegCoreLoadRequest: {
  instance: FFmpeg;
  promise: Promise<void>;
} | null = null;

/**
 * Serialize core loads per shared instance. A close/reopen during the initial
 * download must not send a second LOAD command to the same worker; the new
 * consumer can safely await the load already in progress.
 */
async function loadFFmpegCore(instance: FFmpeg) {
  if (instance.loaded) return;

  const existing = ffmpegCoreLoadRequest;
  if (existing?.instance === instance) {
    await existing.promise;
    return;
  }

  const promise = (async () => {
    try {
      // FFmpeg instances are deliberately reusable after terminate():
      // terminate clears the worker, and load() creates a fresh one.
      // Cancellation therefore does not bypass the warm-object lifecycle.
      // Absolute same-origin URLs are required because the UMD build carries a
      // compile-time file: URL as its import.meta.url fallback; root-relative
      // paths would otherwise be resolved against that incorrect base.
      await instance.load({
        classWorkerURL: sameOriginAssetUrl(FFMPEG_WORKER_PATH),
        coreURL: sameOriginAssetUrl(FFMPEG_CORE_PATH),
        wasmURL: sameOriginAssetUrl(FFMPEG_WASM_PATH),
      });
    } catch (error) {
      // A partial/failed core load should not be kept warm. terminate()
      // resets the instance while preserving the cheap JS wrapper for a
      // later retry.
      try {
        instance.terminate();
      } catch {
        // Best effort only.
      }
      throw error;
    }
  })();

  const request = { instance, promise };
  ffmpegCoreLoadRequest = request;
  try {
    await promise;
  } finally {
    if (ffmpegCoreLoadRequest === request) {
      ffmpegCoreLoadRequest = null;
    }
  }
}

export default function Ffmpeg() {
  const [loadFfmpeg, setLoadedFfmpeg] = useState(false);
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  const ffmpegLeaseRef = useRef<WarmResourceLease<FFmpeg> | null>(null);
  const mountedRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const loadRequestRef = useRef<{
    generation: number;
    promise: Promise<void>;
  } | null>(null);

  const loadFFmpegFunction = useCallback(async () => {
    const existingFFmpeg = ffmpegLeaseRef.current?.resource;
    if (existingFFmpeg?.loaded) {
      if (mountedRef.current) {
        setFfmpeg(existingFFmpeg);
        setLoadedFfmpeg(true);
      }
      return;
    }

    const generation = loadGenerationRef.current;
    const existingRequest = loadRequestRef.current;
    if (existingRequest?.generation === generation) {
      await existingRequest.promise;
      return;
    }

    setLoadedFfmpeg(false);
    const request = {} as {
      generation: number;
      promise: Promise<void>;
    };

    const promise = (async () => {
      try {
        let ffmpegInstance = ffmpegLeaseRef.current?.resource;
        if (!ffmpegInstance) {
          const FFmpegConstructor = await loadFFmpegConstructor();

          // The modal can close while the control module is still loading.
          // Do not create an ownerless worker wrapper in that case.
          if (!mountedRef.current || generation !== loadGenerationRef.current) {
            return;
          }

          if (!ffmpegLeaseRef.current) {
            ffmpegLeaseRef.current = acquireFFmpegLease(FFmpegConstructor);
          }
          ffmpegInstance = ffmpegLeaseRef.current.resource;
          setFfmpeg(ffmpegInstance);
        }

        await loadFFmpegCore(ffmpegInstance);

        if (!mountedRef.current || generation !== loadGenerationRef.current) {
          return;
        }

        setFfmpeg(ffmpegInstance);
        setLoadedFfmpeg(true);
        toast.success("FFmpeg loaded successfully");
      } catch (error) {
        if (mountedRef.current && generation === loadGenerationRef.current) {
          console.error("Failed to load FFmpeg:", error);
          toast.error("Failed to load FFmpeg");
          setLoadedFfmpeg(false);
        }
      } finally {
        if (loadRequestRef.current === request) {
          loadRequestRef.current = null;
        }
      }
    })();

    request.generation = generation;
    request.promise = promise;
    loadRequestRef.current = request;
    await promise;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadGenerationRef.current += 1;
    void loadFFmpegFunction();

    return () => {
      mountedRef.current = false;
      loadGenerationRef.current += 1;

      // Do not terminate a healthy idle worker here. Reopening the modal can
      // reuse it during the bounded warm window; the lifecycle disposes it if
      // it remains unused. Active encodes are still terminated by
      // FfmpegRender's cancellation cleanup before they can become stale.
      const lease = ffmpegLeaseRef.current;
      ffmpegLeaseRef.current = null;
      lease?.release();
    };
  }, [loadFFmpegFunction]);

  return (
    <div className="flex flex-col justify-center items-center py-2">
      <RenderOptions />
      {ffmpeg && (
        <FfmpegRender
          loadFunction={loadFFmpegFunction}
          loadFfmpeg={loadFfmpeg}
          ffmpeg={ffmpeg}
        />
      )}
    </div>
  );
}
