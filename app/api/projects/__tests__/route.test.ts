import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  redisGet,
  redisSet,
  redisConfigured,
  enforceProjectRateLimit,
} = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisConfigured: vi.fn(),
  enforceProjectRateLimit: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: redisGet,
    set: redisSet,
  },
  isRedisConfigured: redisConfigured,
  REDIS_CONFIGURATION_MESSAGE:
    "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN).",
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceProjectRateLimit,
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
    redisGet.mockReset();
    redisSet.mockReset();
    redisConfigured.mockReset();
    enforceProjectRateLimit.mockReset();

    redisConfigured.mockReturnValue(true);
    enforceProjectRateLimit.mockResolvedValue(null);
    redisSet.mockResolvedValue("OK");
  });

  it("creates a project with the existing response shape and 7-day TTL", async () => {
    const response = await POST(validPost("!scene\n!text\nHello"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projectId).toMatch(/^[A-Za-z0-9_-]{11}$/);

    expect(redisSet).toHaveBeenCalledTimes(1);
    const [key, markdown, options] = redisSet.mock.calls[0];
    expect(key).toBe(`project:${body.projectId}`);
    expect(markdown).toBe("!scene\n!text\nHello");
    expect(options).toEqual({ ex: PROJECT_TTL_SECONDS });
  });

  it("returns 400 for malformed JSON instead of a generic 500", async () => {
    const response = await POST(postBody("{not-json"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/malformed json/i);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("returns 413 when the request body exceeds 1 MiB", async () => {
    const oversizedBody = JSON.stringify({ markdown: "x".repeat(ONE_MEBIBYTE) });
    expect(Buffer.byteLength(oversizedBody, "utf8")).toBeGreaterThan(ONE_MEBIBYTE);

    const response = await POST(postBody(oversizedBody));
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toMatch(/too large/i);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("enforces the body cap for streamed bodies without a content-length", async () => {
    const request = postChunkedBody(["{\"markdown\":\"", "x".repeat(ONE_MEBIBYTE), "\"}"]);
    expect(request.headers.get("content-length")).toBeNull();

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("accepts a request body exactly at the 1 MiB boundary", async () => {
    const overhead = Buffer.byteLength('{"markdown":""}', "utf8");
    const exactBoundaryBody = `{"markdown":"${"x".repeat(ONE_MEBIBYTE - overhead)}"}`;
    expect(Buffer.byteLength(exactBoundaryBody, "utf8")).toBe(ONE_MEBIBYTE);

    const response = await POST(postBody(exactBoundaryBody));

    expect(response.status).toBe(200);
    expect(redisSet).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when markdown is missing or is not a string", async () => {
    for (const value of [{}, { markdown: 42 }, { markdown: "" }]) {
      const response = await POST(postBody(JSON.stringify(value)));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Markdown is required");
    }
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("returns a clear 503 when Redis is not configured", async () => {
    redisConfigured.mockReturnValue(false);

    const response = await POST(validPost());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("Redis is not configured");
    expect(body.error).toContain("UPSTASH_REDIS_REST_URL");
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("returns the rate-limit response before writing", async () => {
    enforceProjectRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(validPost());

    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("Rate limit exceeded");
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("loads a valid project using the existing response shape", async () => {
    redisGet.mockResolvedValue("!scene\n!text\nStored");

    const response = await GET(getProject("abcDEF123-_"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ markdown: "!scene\n!text\nStored" });
    expect(redisGet).toHaveBeenCalledWith("project:abcDEF123-_");
  });

  it("keeps requiring a project ID", async () => {
    const response = await GET(getProject());

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Project ID is required");
    expect(redisGet).not.toHaveBeenCalled();
  });

  it("rejects malformed project IDs before hitting Redis", async () => {
    for (const id of ["too short", "abcDEF123456", "abcDEF123$%", "../abcDEF1"]) {
      const response = await GET(getProject(id));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Invalid project ID");
    }
    expect(redisGet).not.toHaveBeenCalled();
  });

  it("returns 404 when the project does not exist", async () => {
    redisGet.mockResolvedValue(null);

    const response = await GET(getProject("abcDEF123-_"));

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Project not found");
  });

  it("returns the rate-limit response before reading", async () => {
    enforceProjectRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET(getProject("abcDEF123-_"));

    expect(response.status).toBe(429);
    expect(redisGet).not.toHaveBeenCalled();
  });
});
