import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  kvGet,
  kvSet,
  kvConfigured,
  enforceProjectReadRateLimit,
  enforceProjectWriteRateLimit,
} = vi.hoisted(() => ({
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  kvConfigured: vi.fn(),
  enforceProjectReadRateLimit: vi.fn(),
  enforceProjectWriteRateLimit: vi.fn(),
}));

vi.mock("@/lib/kv", () => ({
  kvGet,
  kvSet,
  isKvConfigured: kvConfigured,
  KV_CONFIGURATION_MESSAGE:
    "Storage is not configured. Set NEON_DATABASE_URL or DATABASE_URL for Postgres storage, or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN) for Redis storage.",
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceProjectReadRateLimit,
  enforceProjectWriteRateLimit,
}));

import { GET, POST } from "../route";

const ONE_MEBIBYTE = 1024 * 1024;
const PROJECT_TTL_SECONDS = 60 * 60 * 24 * 7;

function postBody(body: string) {
  return new NextRequest("http://localhost/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

function validPost(markdown = "# Hello") {
  return postBody(JSON.stringify({ markdown }));
}

function postChunkedBody(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new NextRequest("http://localhost/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    duplex: "half",
  });
}

function getProject(id?: string) {
  const url = id === undefined
    ? "http://localhost/api/projects"
    : `http://localhost/api/projects?id=${encodeURIComponent(id)}`;
  return new NextRequest(url);
}

describe("/api/projects", () => {
  beforeEach(() => {
    kvGet.mockReset();
    kvSet.mockReset();
    kvConfigured.mockReset();
    enforceProjectReadRateLimit.mockReset();
    enforceProjectWriteRateLimit.mockReset();

    kvConfigured.mockReturnValue(true);
    enforceProjectReadRateLimit.mockResolvedValue(null);
    enforceProjectWriteRateLimit.mockResolvedValue(null);
    kvSet.mockResolvedValue(undefined);
  });

  it("creates a project with the existing response shape and 7-day TTL", async () => {
    const response = await POST(validPost("!scene\n!text\nHello"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projectId).toMatch(/^[A-Za-z0-9_-]{11}$/);

    expect(kvSet).toHaveBeenCalledTimes(1);
    const [key, storedValue, ttlSeconds] = kvSet.mock.calls[0];
    expect(key).toBe(`project:${body.projectId}`);
    // The markdown is wrapped in a versioned object so the storage round-trip
    // is type-safe even for documents that are themselves valid JSON.
    expect(JSON.parse(storedValue)).toEqual({ v: 1, markdown: "!scene\n!text\nHello" });
    expect(ttlSeconds).toBe(PROJECT_TTL_SECONDS);
  });

  it("applies the write rate limit to POST before reading the body or storing", async () => {
    const response = await POST(validPost());

    expect(response.status).toBe(200);
    expect(enforceProjectWriteRateLimit).toHaveBeenCalledTimes(1);
    expect(enforceProjectReadRateLimit).not.toHaveBeenCalled();
  });

  it("applies the read rate limit to GET", async () => {
    kvGet.mockResolvedValue(JSON.stringify({ v: 1, markdown: "stored" }));

    const response = await GET(getProject("abcDEF123-_"));

    expect(response.status).toBe(200);
    expect(enforceProjectReadRateLimit).toHaveBeenCalledTimes(1);
    expect(enforceProjectWriteRateLimit).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON instead of a generic 500", async () => {
    const response = await POST(postBody("{not-json"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/malformed json/i);
    expect(kvSet).not.toHaveBeenCalled();
  });

  it("returns 413 when the request body exceeds 1 MiB", async () => {
    const oversizedBody = JSON.stringify({ markdown: "x".repeat(ONE_MEBIBYTE) });
    expect(Buffer.byteLength(oversizedBody, "utf8")).toBeGreaterThan(ONE_MEBIBYTE);

    const response = await POST(postBody(oversizedBody));
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toMatch(/too large/i);
    expect(kvSet).not.toHaveBeenCalled();
  });

  it("enforces the body cap for streamed bodies without a content-length", async () => {
    const request = postChunkedBody(["{\"markdown\":\"", "x".repeat(ONE_MEBIBYTE), "\"}"]);
    expect(request.headers.get("content-length")).toBeNull();

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(kvSet).not.toHaveBeenCalled();
  });

  it("accepts a request body exactly at the 1 MiB boundary", async () => {
    const overhead = Buffer.byteLength('{"markdown":""}', "utf8");
    const exactBoundaryBody = `{"markdown":"${"x".repeat(ONE_MEBIBYTE - overhead)}"}`;
    expect(Buffer.byteLength(exactBoundaryBody, "utf8")).toBe(ONE_MEBIBYTE);

    const response = await POST(postBody(exactBoundaryBody));

    expect(response.status).toBe(200);
    expect(kvSet).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when markdown is missing or is not a string", async () => {
    for (const value of [{}, { markdown: 42 }, { markdown: "" }]) {
      const response = await POST(postBody(JSON.stringify(value)));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Markdown is required");
    }
    expect(kvSet).not.toHaveBeenCalled();
  });

  it("returns a clear 503 naming both backends when storage is not configured", async () => {
    kvConfigured.mockReturnValue(false);

    const response = await POST(validPost());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("Storage is not configured");
    expect(body.error).toContain("NEON_DATABASE_URL");
    expect(body.error).toContain("UPSTASH_REDIS_REST_URL");
    expect(kvSet).not.toHaveBeenCalled();
  });

  it("returns the write rate-limit response before writing", async () => {
    enforceProjectWriteRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(validPost());

    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("Rate limit exceeded");
    expect(kvSet).not.toHaveBeenCalled();
  });

  it("loads a project stored in the versioned wrapper shape", async () => {
    kvGet.mockResolvedValue(JSON.stringify({ v: 1, markdown: "!scene\n!text\nStored" }));

    const response = await GET(getProject("abcDEF123-_"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ markdown: "!scene\n!text\nStored" });
    expect(kvGet).toHaveBeenCalledWith("project:abcDEF123-_");
  });

  it("still loads legacy plain-string projects", async () => {
    kvGet.mockResolvedValue("!scene\n!text\nLegacy");

    const response = await GET(getProject("abcDEF123-_"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ markdown: "!scene\n!text\nLegacy" });
  });

  it("recovers legacy scalar-corrupted documents with String conversion", async () => {
    // A legacy plain-string write whose entire markdown was `42` reads back
    // through the facade as the canonical JSON scalar text.
    kvGet.mockResolvedValue("42");

    const response = await GET(getProject("abcDEF123-_"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ markdown: "42" });
  });

  it("recovers legacy boolean-corrupted documents", async () => {
    kvGet.mockResolvedValue("true");

    const response = await GET(getProject("abcDEF123-_"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ markdown: "true" });
  });

  it("round-trips numeric-looking markdown through the wrapper shape", async () => {
    const postResponse = await POST(validPost("42"));
    expect(postResponse.status).toBe(200);

    const [, storedValue] = kvSet.mock.calls[0];
    expect(JSON.parse(storedValue)).toEqual({ v: 1, markdown: "42" });

    // The wrapper object is stored as canonical JSON on every backend and
    // parses back into the same shape on read.
    kvGet.mockResolvedValue(storedValue);

    const getResponse = await GET(getProject("abcDEF123-_"));
    const body = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(body).toEqual({ markdown: "42" });
  });

  it("keeps requiring a project ID", async () => {
    const response = await GET(getProject());

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Project ID is required");
    expect(kvGet).not.toHaveBeenCalled();
  });

  it("rejects malformed project IDs before hitting Redis", async () => {
    for (const id of ["too short", "abcDEF123456", "abcDEF123$%", "../abcDEF1"]) {
      const response = await GET(getProject(id));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Invalid project ID");
    }
    expect(kvGet).not.toHaveBeenCalled();
  });

  it("returns 404 when the project does not exist", async () => {
    kvGet.mockResolvedValue(null);

    const response = await GET(getProject("abcDEF123-_"));

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Project not found");
  });

  it("returns the read rate-limit response before reading", async () => {
    enforceProjectReadRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET(getProject("abcDEF123-_"));

    expect(response.status).toBe(429);
    expect(kvGet).not.toHaveBeenCalled();
  });
});
