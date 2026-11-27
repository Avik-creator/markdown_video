import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  kvSlidingWindowLimit,
  isKvConfigured,
} = vi.hoisted(() => ({
  kvSlidingWindowLimit: vi.fn(),
  isKvConfigured: vi.fn(),
}));

vi.mock("@/lib/kv", () => ({
  kvSlidingWindowLimit,
  isKvConfigured,
}));

import {
  MCP_RATE_LIMIT,
  MCP_RENDER_PREVIEW_RATE_LIMIT,
  MCP_RENDER_VIDEO_RATE_LIMIT,
  PROJECTS_READ_RATE_LIMIT,
  PROJECTS_WRITE_RATE_LIMIT,
  RENDERS_READ_RATE_LIMIT,
  enforceMcpRateLimit,
  enforceMcpRenderPreviewRateLimit,
  enforceMcpRenderVideoRateLimit,
  enforceProjectReadRateLimit,
  enforceProjectWriteRateLimit,
  enforceRenderReadRateLimit,
  getClientIp,
} from "../rate-limit";

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/test", { headers });
}

function allowedResult() {
  return {
    success: true,
    limit: 30,
    remaining: 29,
    reset: Date.now() + 30_000,
  };
}

describe("getClientIp", () => {
  it("prefers x-vercel-forwarded-for over x-real-ip and x-forwarded-for", () => {
    expect(
      getClientIp(
        request({
          "x-vercel-forwarded-for": "198.51.100.23",
          "x-real-ip": "203.0.113.8",
          "x-forwarded-for": "192.0.2.10",
        })
      )
    ).toBe("198.51.100.23");
  });

  it("uses the first address of a multi-valued x-vercel-forwarded-for", () => {
    expect(
      getClientIp(
        request({ "x-vercel-forwarded-for": "198.51.100.23, 203.0.113.8" })
      )
    ).toBe("198.51.100.23");
  });

  it("prefers x-real-ip over x-forwarded-for when no Vercel header exists", () => {
    expect(
      getClientIp(
        request({
          "x-real-ip": "203.0.113.8",
          "x-forwarded-for": "192.0.2.10",
        })
      )
    ).toBe("203.0.113.8");
  });

  it("uses the first address from x-forwarded-for as the last header fallback", () => {
    expect(
      getClientIp(request({ "x-forwarded-for": "198.51.100.23, 203.0.113.8" }))
    ).toBe("198.51.100.23");
  });

  it("skips blank x-vercel-forwarded-for entries before falling back", () => {
    expect(
      getClientIp(
        request({
          "x-vercel-forwarded-for": "  ",
          "x-real-ip": "203.0.113.8",
        })
      )
    ).toBe("203.0.113.8");
  });

  it("caps overlong header values at the IP length limit", () => {
    const overlong = `${"1".repeat(200)}`;
    const ip = getClientIp(request({ "x-vercel-forwarded-for": overlong }));
    expect(ip.length).toBeLessThanOrEqual(128);
  });

  it("falls back to unknown when no forwarding headers are present", () => {
    expect(getClientIp(request())).toBe("unknown");
  });
});

describe("rate-limit enforcement", () => {
  beforeEach(() => {
    kvSlidingWindowLimit.mockReset();
    isKvConfigured.mockReset();

    isKvConfigured.mockReturnValue(true);
    kvSlidingWindowLimit.mockResolvedValue(allowedResult());
  });

  it("allows requests under the limit and uses the client IP as the identifier", async () => {
    const response = await enforceProjectReadRateLimit(
      request({ "x-forwarded-for": "198.51.100.23, 203.0.113.8" })
    );

    expect(response).toBeNull();
    expect(kvSlidingWindowLimit).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: "198.51.100.23" })
    );
  });

  it("configures the documented sliding-window limits in milliseconds", async () => {
    await enforceProjectReadRateLimit(request());
    await enforceProjectWriteRateLimit(request());
    await enforceMcpRateLimit(request());

    expect(kvSlidingWindowLimit).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "markdown-video:projects:read", limit: 30, windowMs: 60_000 })
    );
    expect(kvSlidingWindowLimit).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "markdown-video:projects:write", limit: 10, windowMs: 3_600_000 })
    );
    expect(kvSlidingWindowLimit).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "markdown-video:mcp", limit: 60, windowMs: 60_000 })
    );
  });

  it("documents the project read/write split: 30 reads per minute, 10 writes per hour", () => {
    expect(PROJECTS_READ_RATE_LIMIT.limit).toBe(30);
    expect(PROJECTS_READ_RATE_LIMIT.window).toBe("1 m");
    expect(PROJECTS_READ_RATE_LIMIT.failureMode).toBe("fail-closed");
    expect(PROJECTS_WRITE_RATE_LIMIT.limit).toBe(10);
    expect(PROJECTS_WRITE_RATE_LIMIT.window).toBe("1 h");
    expect(PROJECTS_WRITE_RATE_LIMIT.failureMode).toBe("fail-closed");
    // The policies must not share a storage key prefix, or their counters would
    // interfere with each other.
    expect(PROJECTS_READ_RATE_LIMIT.prefix).not.toBe(PROJECTS_WRITE_RATE_LIMIT.prefix);
  });

  it("documents the expensive render policies as tight, distinct, and fail-closed", async () => {
    await enforceMcpRenderPreviewRateLimit(request());
    await enforceMcpRenderVideoRateLimit(request());
    await enforceRenderReadRateLimit(request());

    expect(MCP_RENDER_PREVIEW_RATE_LIMIT).toMatchObject({
      limit: 10,
      window: "1 h",
      failureMode: "fail-closed",
    });
    expect(MCP_RENDER_VIDEO_RATE_LIMIT).toMatchObject({
      limit: 5,
      window: "1 h",
      failureMode: "fail-closed",
    });
    expect(RENDERS_READ_RATE_LIMIT).toMatchObject({
      limit: 120,
      window: "1 m",
      failureMode: "fail-closed",
    });
    expect(new Set([
      MCP_RENDER_PREVIEW_RATE_LIMIT.prefix,
      MCP_RENDER_VIDEO_RATE_LIMIT.prefix,
      RENDERS_READ_RATE_LIMIT.prefix,
      MCP_RATE_LIMIT.prefix,
    ]).size).toBe(4);
    expect(kvSlidingWindowLimit).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, windowMs: 3_600_000 })
    );
    expect(kvSlidingWindowLimit).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, windowMs: 3_600_000 })
    );
    expect(kvSlidingWindowLimit).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 120, windowMs: 60_000 })
    );
  });

  it("enforces the write policy for project writes with the client IP", async () => {
    const response = await enforceProjectWriteRateLimit(
      request({ "x-vercel-forwarded-for": "198.51.100.55" })
    );

    expect(response).toBeNull();
    expect(kvSlidingWindowLimit).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: "198.51.100.55" })
    );
  });

  it("returns 429 with retry metadata when the limiter denies a request", async () => {
    const reset = Date.now() + 20_000;
    kvSlidingWindowLimit.mockResolvedValueOnce({
      success: false,
      limit: 30,
      remaining: 0,
      reset,
    });

    const response = await enforceProjectReadRateLimit(request());

    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
    expect((await response!.json()).error).toMatch(/rate limit exceeded/i);
    expect(Number(response!.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(Number(response!.headers.get("retry-after"))).toBeLessThanOrEqual(20);
    expect(response!.headers.get("x-ratelimit-limit")).toBe("30");
    expect(response!.headers.get("x-ratelimit-remaining")).toBe("0");
  });

  it("fails closed with 503 when storage is missing for the projects API", async () => {
    isKvConfigured.mockReturnValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await enforceProjectReadRateLimit(request());

    expect(response).not.toBeNull();
    expect(response!.status).toBe(503);
    expect((await response!.json()).error).toMatch(/rate limiting is unavailable/i);
    expect(kvSlidingWindowLimit).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("fails closed when a projects rate-limit check times out", async () => {
    kvSlidingWindowLimit.mockResolvedValueOnce({
      ...allowedResult(),
      reason: "timeout",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await enforceProjectReadRateLimit(request());

    expect(response).not.toBeNull();
    expect(response!.status).toBe(503);
    warn.mockRestore();
  });

  it("fails closed when the projects limiter throws", async () => {
    kvSlidingWindowLimit.mockRejectedValueOnce(new Error("storage unreachable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await enforceProjectReadRateLimit(request());

    expect(response).not.toBeNull();
    expect(response!.status).toBe(503);
    warn.mockRestore();
  });

  it("accepts a headers-only source for direct project-share resolution", async () => {
    const response = await enforceProjectReadRateLimit({
      headers: new Headers({ "x-forwarded-for": "198.51.100.101" }),
    });

    expect(response).toBeNull();
    expect(kvSlidingWindowLimit).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: "198.51.100.101" })
    );
  });

  it("uses a bounded process-local fallback instead of becoming unthrottled when MCP storage is missing", async () => {
    isKvConfigured.mockReturnValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const limitedRequest = () =>
      request({ "x-forwarded-for": "198.51.100.120" });

    for (let attempt = 0; attempt < MCP_RATE_LIMIT.limit; attempt++) {
      expect(await enforceMcpRateLimit(limitedRequest())).toBeNull();
    }

    const response = await enforceMcpRateLimit(limitedRequest());

    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
    expect((await response!.json()).error).toMatch(/rate limit exceeded/i);
    expect(response!.headers.get("x-ratelimit-limit")).toBe(String(MCP_RATE_LIMIT.limit));
    expect(
      await enforceMcpRateLimit(request({ "x-forwarded-for": "198.51.100.121" }))
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("process-local"),
      expect.anything()
    );
    warn.mockRestore();
  });

  it("resets the MCP process-local fallback when the window expires", async () => {
    vi.useFakeTimers();
    try {
      isKvConfigured.mockReturnValue(false);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const limitedRequest = () =>
        request({ "x-forwarded-for": "198.51.100.122" });

      for (let attempt = 0; attempt < MCP_RATE_LIMIT.limit; attempt++) {
        expect(await enforceMcpRateLimit(limitedRequest())).toBeNull();
      }
      expect((await enforceMcpRateLimit(limitedRequest()))?.status).toBe(429);

      vi.advanceTimersByTime(60_001);

      expect(await enforceMcpRateLimit(limitedRequest())).toBeNull();
      warn.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("documents and uses fail-open behavior for MCP when storage is missing", async () => {
    isKvConfigured.mockReturnValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await enforceMcpRateLimit(request());

    expect(response).toBeNull();
    expect(kvSlidingWindowLimit).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("fails open for MCP when the limiter throws", async () => {
    kvSlidingWindowLimit.mockRejectedValueOnce(new Error("storage unreachable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await enforceMcpRateLimit(request());

    expect(response).toBeNull();
    warn.mockRestore();
  });
});
