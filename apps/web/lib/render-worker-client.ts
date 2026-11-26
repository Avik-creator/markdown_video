import { z } from "zod";

const PREVIEW_TIMEOUT_MS = 22_000;
const VIDEO_TIMEOUT_MS = 47_000;
const MAX_ERROR_BODY_CHARS = 1_000;

const previewResponseSchema = z.object({
  duration: z.number().finite().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frames: z
    .array(
      z.object({
        time: z.number().finite().nonnegative(),
        pngBase64: z.string().min(1),
      })
    )
    .min(3)
    .max(6),
});

export type WorkerPreviewResponse = z.infer<typeof previewResponseSchema>;

export interface WorkerVideoResponse {
  mp4: Buffer;
  duration: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  sizeBytes: number;
}

export class RenderWorkerConfigurationError extends Error {
  constructor() {
    super(
      "Rendering is not configured. Set RENDER_WORKER_URL and RENDER_WORKER_SHARED_SECRET."
    );
    this.name = "RenderWorkerConfigurationError";
  }
}

export class RenderWorkerRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderWorkerRequestError";
  }
}

function workerConfig() {
  const rawUrl = process.env.RENDER_WORKER_URL;
  const sharedSecret = process.env.RENDER_WORKER_SHARED_SECRET;
  if (!rawUrl || !sharedSecret) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RenderWorkerRequestError("RENDER_WORKER_URL is not a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new RenderWorkerRequestError("RENDER_WORKER_URL must use http or https.");
  }
  return { baseUrl: url.toString().replace(/\/$/, ""), sharedSecret };
}

export function isRenderWorkerConfigured() {
  return workerConfig() !== null;
}

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function workerFetch(
  pathname: string,
  body: unknown,
  timeoutMs: number,
) {
  const config = workerConfig();
  if (!config) throw new RenderWorkerConfigurationError();
  const timeout = timeoutSignal(timeoutMs);
  try {
    return await fetch(`${config.baseUrl}${pathname}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.sharedSecret}`,
      },
      body: JSON.stringify(body),
      signal: timeout.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new RenderWorkerRequestError("Render worker request timed out.");
    }
    throw new RenderWorkerRequestError(
      `Could not reach the render worker: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    timeout.clear();
  }
}

async function throwForWorkerError(response: Response): Promise<void> {
  if (response.ok) return;
  let detail = "";
  try {
    const text = (await response.text()).slice(0, MAX_ERROR_BODY_CHARS);
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === "string") detail = `: ${parsed.error}`;
  } catch {
    // Non-JSON worker/proxy errors still carry the status.
  }
  throw new RenderWorkerRequestError(
    `Render worker failed with HTTP ${response.status}${detail}`
  );
}

function numericHeader(response: Response, name: string) {
  const value = Number(response.headers.get(name));
  if (!Number.isFinite(value)) {
    throw new RenderWorkerRequestError(`Render worker omitted valid ${name} metadata.`);
  }
  return value;
}

export async function renderWorkerPreview(input: {
  markdown: string;
  times?: number[];
  aspectRatio?: string;
  locale?: string | null;
}): Promise<WorkerPreviewResponse> {
  const response = await workerFetch("/v1/preview", input, PREVIEW_TIMEOUT_MS);
  await throwForWorkerError(response);
  const json: unknown = await response.json();
  const parsed = previewResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new RenderWorkerRequestError("Render worker returned malformed preview data.");
  }
  return parsed.data;
}

export async function renderWorkerVideo(input: {
  markdown: string;
  options?: {
    resolution?: string;
    quality?: string;
    speed?: string;
    fps?: number;
    aspectRatio?: string;
    locale?: string | null;
  };
}): Promise<WorkerVideoResponse> {
  const response = await workerFetch("/v1/video", input, VIDEO_TIMEOUT_MS);
  await throwForWorkerError(response);
  if ((response.headers.get("content-type") ?? "").split(";")[0] !== "video/mp4") {
    throw new RenderWorkerRequestError("Render worker did not return video/mp4 content.");
  }
  const mp4 = Buffer.from(await response.arrayBuffer());
  if (mp4.byteLength === 0) {
    throw new RenderWorkerRequestError("Render worker returned an empty mp4.");
  }
  return {
    mp4,
    duration: numericHeader(response, "x-mv-duration"),
    width: numericHeader(response, "x-mv-width"),
    height: numericHeader(response, "x-mv-height"),
    fps: numericHeader(response, "x-mv-fps"),
    totalFrames: numericHeader(response, "x-mv-frames"),
    sizeBytes: mp4.byteLength,
  };
}
