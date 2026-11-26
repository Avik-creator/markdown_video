import { randomBytes } from "node:crypto";

import { isRedisConfigured, redis } from "@/lib/redis";

/**
 * Rendered mp4 objects are temporary derivatives, not source documents. One
 * hour is long enough for an agent/user to inspect or download a result while
 * bounding Redis storage growth from the public render tool.
 */
export const RENDER_VIDEO_TTL_SECONDS = 60 * 60;
/**
 * Upstash's common REST request cap is 10 MB. Base64 inflates binary data by
 * 4/3, so 6 MiB of mp4 becomes exactly 8 MiB of payload plus small JSON/key
 * overhead — comfortably below the limit while covering typical short renders.
 */
export const MAX_RENDER_VIDEO_BYTES = 6 * 1024 * 1024;
export const RENDER_VIDEO_ID_PATTERN = /^[a-f0-9]{32}$/;

const RENDER_STORAGE_VERSION = 1;
const RENDER_VIDEO_KEY_PREFIX = "markdown-video:render:video:";

export interface RenderVideoMetadata {
  id: string;
  sizeBytes: number;
  duration: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  expiresAt: string;
  ttlSeconds: number;
}

export interface RenderVideoObject {
  metadata: RenderVideoMetadata;
  mp4: Buffer;
}

type StoredRenderVideo = {
  v: typeof RENDER_STORAGE_VERSION;
  encoding: "base64";
  contentType: "video/mp4";
  data: string;
  sizeBytes: number;
  duration: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  expiresAt: string;
};

export class RenderStorageConfigurationError extends Error {
  constructor() {
    super(
      "Render storage is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN)."
    );
    this.name = "RenderStorageConfigurationError";
  }
}

export class RenderVideoTooLargeError extends Error {
  constructor(sizeBytes: number) {
    super(
      `Rendered mp4 is ${sizeBytes} bytes; the storage cap is ${MAX_RENDER_VIDEO_BYTES} bytes.`
    );
    this.name = "RenderVideoTooLargeError";
  }
}

export function isRenderStorageConfigured() {
  return isRedisConfigured();
}

export function isRenderVideoId(id: string) {
  return RENDER_VIDEO_ID_PATTERN.test(id);
}

function renderVideoKey(id: string) {
  return `${RENDER_VIDEO_KEY_PREFIX}${id}`;
}

function metadataFor(id: string, stored: Omit<StoredRenderVideo, "v" | "encoding" | "contentType" | "data">): RenderVideoMetadata {
  return {
    id,
    sizeBytes: stored.sizeBytes,
    duration: stored.duration,
    width: stored.width,
    height: stored.height,
    fps: stored.fps,
    totalFrames: stored.totalFrames,
    expiresAt: stored.expiresAt,
    ttlSeconds: RENDER_VIDEO_TTL_SECONDS,
  };
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function isStoredRenderVideo(value: unknown): value is StoredRenderVideo {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.v === RENDER_STORAGE_VERSION &&
    record.encoding === "base64" &&
    record.contentType === "video/mp4" &&
    typeof record.data === "string" &&
    finiteNumber(record.sizeBytes) &&
    finiteNumber(record.duration) &&
    finiteNumber(record.width) &&
    finiteNumber(record.height) &&
    finiteNumber(record.fps) &&
    finiteNumber(record.totalFrames) &&
    typeof record.expiresAt === "string"
  );
}

/**
 * Store an mp4 in the existing Redis backend as a versioned base64 object.
 * Redis values are binary-safe in principle, but the Upstash REST client JSON
 * round-trip is not a binary transport; base64 makes the payload explicit and
 * keeps the implementation small at the cost of 33% storage overhead.
 */
export async function storeRenderVideo({
  mp4,
  duration,
  width,
  height,
  fps,
  totalFrames,
}: {
  mp4: Buffer | Uint8Array;
  duration: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
}): Promise<RenderVideoMetadata> {
  if (!isRedisConfigured()) {
    throw new RenderStorageConfigurationError();
  }
  if (mp4.byteLength > MAX_RENDER_VIDEO_BYTES) {
    throw new RenderVideoTooLargeError(mp4.byteLength);
  }

  const id = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + RENDER_VIDEO_TTL_SECONDS * 1_000).toISOString();
  const stored: StoredRenderVideo = {
    v: RENDER_STORAGE_VERSION,
    encoding: "base64",
    contentType: "video/mp4",
    data: Buffer.from(mp4).toString("base64"),
    sizeBytes: mp4.byteLength,
    duration,
    width,
    height,
    fps,
    totalFrames,
    expiresAt,
  };

  await redis.set(renderVideoKey(id), stored, { ex: RENDER_VIDEO_TTL_SECONDS });
  return metadataFor(id, stored);
}

/**
 * Read and decode a stored mp4. Missing, expired, or malformed values all
 * behave as not-found: callers never need to distinguish an expired artifact
 * from an unguessable ID that never existed.
 */
export async function readRenderVideo(id: string): Promise<RenderVideoObject | null> {
  if (!isRedisConfigured()) {
    throw new RenderStorageConfigurationError();
  }
  if (!isRenderVideoId(id)) {
    return null;
  }

  const value: unknown = await redis.get(renderVideoKey(id));
  if (!isStoredRenderVideo(value)) {
    return null;
  }

  const expiresAtMs = Date.parse(value.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null;
  }

  const mp4 = Buffer.from(value.data, "base64");
  if (mp4.byteLength !== value.sizeBytes || mp4.byteLength === 0) {
    return null;
  }

  return {
    metadata: metadataFor(id, value),
    mp4,
  };
}
