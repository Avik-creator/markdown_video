import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  limit,
  slidingWindow,
  ratelimitConstructor,
  isRedisConfigured,
  getRedis,
} = vi.hoisted(() => ({
  limit: vi.fn(),
  slidingWindow: vi.fn(),
  ratelimitConstructor: vi.fn(),
  isRedisConfigured: vi.fn(),
  getRedis: vi.fn(),
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow = slidingWindow;
    limit = limit;

    constructor(config: unknown) {
      ratelimitConstructor(config);
    }
  },
}));

vi.mock("@/lib/redis", () => ({
  getRedis,
  isRedisConfigured,
  redis: {},
}));

import {
  MCP_RATE_LIMIT,
  enforceMcpRateLimit,
  enforceProjectRateLimit,
  getClientIp,
} from "../rate-limit";

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/test", { headers });
}

function allowedResponse() {
  return {
    success: true,
    limit: 30,
    remaining: 29,
    reset: Date.now() + 30_000,
    pending: Promise.resolve(),
  };
}

describe("getClientIp", () => {
  it("uses the first address from x-forwarded-for", () => {
    expect(
      getClientIp(request({ "x-forwarded-for": "198.51.100.23, 203.0.113.8" }))
    ).toBe("198.51.100.23");
  });

  it("falls back to x-real-ip and then to unknown", () => {
    expect(getClientIp(request({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(getClientIp(request())).toBe("unknown");
  });
});

describe("rate-limit enforcement", () => {
  beforeEach(() => {
    limit.mockReset();
    slidingWindow.mockReset();
    ratelimitConstructor.mockReset();
    isRedisConfigured.mockReset();
    getRedis.mockReset();

    isRedisConfigured.mockReturnValue(true);
    getRedis.mockReturnValue({});
    slidingWindow.mockReturnValue("sliding-window-limiter");
    limit.mockResolvedValue(allowedResponse());
  });

  it("allows requests under the limit and uses the client IP as the identifier", async () => {
    const response = await enforceProjectRateLimit(
      request({ "x-forwarded-for": "198.51.100.23, 203.0.113.8" })
    );

    expect(response).toBeNull();
    expect(limit).toHaveBeenCalledWith("198.51.100.23");
  });

  it("configures the documented sliding-window limits", async () => {
    await enforceProjectRateLimit(request());
    await enforceMcpRateLimit(request());

    expect(slidingWindow).toHaveBeenCalledWith(30, "1 m");
    expect(slidingWindow).toHaveBeenCalledWith(60, "1 m");
    expect(ratelimitConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "markdown-video:projects", timeout: 1_000 })
    );
    expect(ratelimitConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "markdown-video:mcp", timeout: 1_000 })
    );
  });

  it("returns 429 with retry metadata when the limiter denies a request", async () => {
    const reset = Date.now() + 20_000;
    limit.mockResolvedValueOnce({
      success: false,
      limit: 30,
      remaining: 0,
      reset,
      pending: Promise.resolve(),
    });

    const response = await enforceProjectRateLimit(request());

    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
    expect((await response!.json()).error).toMatch(/rate limit exceeded/i);
    expect(Number(response!.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(Number(response!.headers.get("retry-after"))).toBeLessThanOrEqual(20);
    expect(response!.headers.get("x-ratelimit-limit")).toBe("30");
    expect(response!.headers.get("x-ratelimit-remaining")).toBe("0");
  });

  it("fails closed with 503 when Redis is missing for the projects API", async () => {
    isRedisConfigured.mockReturnValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await enforceProjectRateLimit(request());

    expect(response).not.toBeNull();
    expect(response!.status).toBe(503);
    expect((await response!.json()).error).toMatch(/rate limiting is unavailable/i);
    expect(limit).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("fails closed when a projects rate-limit check times out", async () => {
    limit.mockResolvedValueOnce({
      ...allowedResponse(),
      reason: "timeout",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await enforceProjectRateLimit(request());

    expect(response).not.toBeNull();
    expect(response!.status).toBe(503);
    warn.mockRestore();
  });

  it("fails closed when the projects limiter throws", async () => {
    limit.mockRejectedValueOnce(new Error("redis unreachable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await enforceProjectRateLimit(request());

    expect(response).not.toBeNull();
    expect(response!.status).toBe(503);
    warn.mockRestore();
  });

  it("accepts a headers-only source for direct project-share resolution", async () => {
    const response = await enforceProjectRateLimit({
      headers: new Headers({ "x-forwarded-for": "198.51.100.101" }),
    });

    expect(response).toBeNull();
    expect(limit).toHaveBeenCalledWith("198.51.100.101");
  });

  it("uses a bounded process-local fallback instead of becoming unthrottled when MCP Redis is missing", async () => {
    isRedisConfigured.mockReturnValue(false);
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
      isRedisConfigured.mockReturnValue(false);
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

  it("documents and uses fail-open behavior for MCP when Redis is missing", async () => {
    isRedisConfigured.mockReturnValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await enforceMcpRateLimit(request());

    expect(response).toBeNull();
    expect(limit).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("fails open for MCP when the limiter throws", async () => {
    limit.mockRejectedValueOnce(new Error("redis unreachable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await enforceMcpRateLimit(request());

    expect(response).toBeNull();
    warn.mockRestore();
  });
});
