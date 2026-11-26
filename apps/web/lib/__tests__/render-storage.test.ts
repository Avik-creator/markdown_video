import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, set, isRedisConfigured } = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  isRedisConfigured: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: { get, set },
  isRedisConfigured,
}));

import {
  MAX_RENDER_VIDEO_BYTES,
  RENDER_VIDEO_TTL_SECONDS,
  isRenderVideoId,
  readRenderVideo,
  storeRenderVideo,
  RenderStorageConfigurationError,
  RenderVideoTooLargeError,
} from "../render-storage";

describe("render video storage", () => {
  beforeEach(() => {
    get.mockReset();
    set.mockReset();
    isRedisConfigured.mockReset();
    isRedisConfigured.mockReturnValue(true);
  });

  it("stores base64 mp4 data with a one-hour Redis TTL and unguessable id", async () => {
    const mp4 = Buffer.from("fake mp4 bytes");
    const metadata = await storeRenderVideo({
      mp4,
      duration: 2,
      width: 1280,
      height: 720,
      fps: 24,
      totalFrames: 48,
    });

    expect(isRenderVideoId(metadata.id)).toBe(true);
    expect(metadata.ttlSeconds).toBe(RENDER_VIDEO_TTL_SECONDS);
    expect(set).toHaveBeenCalledWith(
      `markdown-video:render:video:${metadata.id}`,
      expect.objectContaining({
        v: 1,
        encoding: "base64",
        contentType: "video/mp4",
        data: mp4.toString("base64"),
        sizeBytes: mp4.byteLength,
      }),
      { ex: RENDER_VIDEO_TTL_SECONDS }
    );
  });

  it("round-trips a stored video object", async () => {
    const mp4 = Buffer.from("round trip");
    const metadata = await storeRenderVideo({
      mp4,
      duration: 1,
      width: 854,
      height: 480,
      fps: 12,
      totalFrames: 12,
    });
    get.mockResolvedValueOnce(set.mock.calls[0]![1]);

    const asset = await readRenderVideo(metadata.id);
    expect(asset?.mp4.equals(mp4)).toBe(true);
    expect(asset?.metadata.width).toBe(854);
  });

  it("returns null for malformed ids, missing values, and expired values", async () => {
    expect(await readRenderVideo("not-a-render")).toBeNull();
    get.mockResolvedValueOnce(null);
    expect(await readRenderVideo("a".repeat(32))).toBeNull();

    const mp4 = Buffer.from("x");
    const metadata = await storeRenderVideo({
      mp4,
      duration: 1,
      width: 1,
      height: 1,
      fps: 1,
      totalFrames: 1,
    });
    const stored = set.mock.calls.at(-1)![1] as { expiresAt: string };
    get.mockResolvedValueOnce({ ...stored, expiresAt: new Date(0).toISOString() });
    expect(await readRenderVideo(metadata.id)).toBeNull();
  });

  it("fails closed when Redis is unconfigured", async () => {
    isRedisConfigured.mockReturnValue(false);
    await expect(
      storeRenderVideo({ mp4: Buffer.from("x"), duration: 1, width: 1, height: 1, fps: 1, totalFrames: 1 })
    ).rejects.toBeInstanceOf(RenderStorageConfigurationError);
    await expect(readRenderVideo("a".repeat(32))).rejects.toBeInstanceOf(
      RenderStorageConfigurationError
    );
  });

  it("rejects mp4 payloads above the storage cap", async () => {
    await expect(
      storeRenderVideo({
        mp4: Buffer.alloc(MAX_RENDER_VIDEO_BYTES + 1),
        duration: 1,
        width: 1,
        height: 1,
        fps: 1,
        totalFrames: 1,
      })
    ).rejects.toBeInstanceOf(RenderVideoTooLargeError);
    expect(set).not.toHaveBeenCalled();
  });
});
