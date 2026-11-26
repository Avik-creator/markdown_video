import { beforeEach, describe, expect, it, vi } from "vitest";

const { enforceRenderReadRateLimit, readRenderVideo } = vi.hoisted(() => ({
  enforceRenderReadRateLimit: vi.fn(),
  readRenderVideo: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ enforceRenderReadRateLimit }));
vi.mock("@/lib/render-storage", async () => {
  const actual = await vi.importActual<object>("@/lib/render-storage");
  return { ...actual, readRenderVideo };
});

import { GET, HEAD } from "../route";
import { parseSingleByteRange } from "@/lib/render-range";

const id = "a".repeat(32);
const mp4 = Buffer.from("0123456789");

function context() {
  return { params: Promise.resolve({ id }) };
}

function request(headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/renders/${id}`, { headers });
}

function asset() {
  return {
    mp4,
    metadata: {
      id,
      sizeBytes: mp4.byteLength,
      duration: 1,
      width: 854,
      height: 480,
      fps: 12,
      totalFrames: 12,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ttlSeconds: 3600,
    },
  };
}

describe("byte range parsing", () => {
  it.each([
    ["bytes=0-3", { start: 0, end: 3 }],
    ["bytes=4-", { start: 4, end: 9 }],
    ["bytes=-3", { start: 7, end: 9 }],
    ["bytes=20-30", "invalid"],
    ["bytes=5-2", "invalid"],
    ["bytes=0-1,3-4", "invalid"],
  ] as const)("%s", (header, expected) => {
    expect(parseSingleByteRange(header, 10)).toEqual(expected);
  });
});

describe("render serving route", () => {
  beforeEach(() => {
    enforceRenderReadRateLimit.mockReset();
    readRenderVideo.mockReset();
    enforceRenderReadRateLimit.mockResolvedValue(null);
    readRenderVideo.mockResolvedValue(asset());
  });

  it("serves the complete mp4 with video headers", async () => {
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-length")).toBe("10");
    expect(Buffer.from(await response.arrayBuffer()).equals(mp4)).toBe(true);
  });

  it("serves a byte range with 206 and content-range", async () => {
    const response = await GET(request({ range: "bytes=2-5" }), context());
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(response.headers.get("content-length")).toBe("4");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("2345");
  });

  it("rejects unsatisfiable ranges with 416", async () => {
    const response = await GET(request({ range: "bytes=99-100" }), context());
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
  });

  it("supports HEAD without a body but with the same length", async () => {
    const response = await HEAD(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("10");
    expect(await response.text()).toBe("");
  });

  it("returns the rate-limit response before storage access", async () => {
    enforceRenderReadRateLimit.mockResolvedValueOnce(new Response("limited", { status: 429 }));
    const response = await GET(request(), context());
    expect(response.status).toBe(429);
    expect(readRenderVideo).not.toHaveBeenCalled();
  });

  it("returns 404 for malformed or missing renders", async () => {
    const malformed = await GET(request(), { params: Promise.resolve({ id: "bad" }) });
    expect(malformed.status).toBe(404);
    readRenderVideo.mockResolvedValueOnce(null);
    expect((await GET(request(), context())).status).toBe(404);
  });
});
