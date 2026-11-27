import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  neonConstructor,
  neonQuery,
  redisGet,
  redisSet,
  getRedis,
  isRedisConfigured,
  ratelimitLimit,
  slidingWindow,
} = vi.hoisted(() => ({
  neonConstructor: vi.fn(),
  neonQuery: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  getRedis: vi.fn(),
  isRedisConfigured: vi.fn(),
  ratelimitLimit: vi.fn(),
  slidingWindow: vi.fn(),
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: (connectionString: string) => {
    neonConstructor(connectionString);
    return { query: neonQuery };
  },
}));

vi.mock("@/lib/redis", () => ({
  getRedis,
  isRedisConfigured,
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow = slidingWindow;
    limit = ratelimitLimit;

    constructor(public config: unknown) {}
  },
}));

// The facade caches Postgres stores, bootstrap promises, and Redis limiters in
// module scope, so every test re-imports a fresh module while the mocks above
// stay stable across the suite.
async function importKv() {
  vi.resetModules();
  return import("@/lib/kv");
}

function clearStorageEnv() {
  vi.unstubAllEnvs();
}

describe("kv facade backend selection", () => {
  beforeEach(() => {
    neonConstructor.mockClear();
    neonQuery.mockReset();
    redisGet.mockReset();
    redisSet.mockReset();
    getRedis.mockReset();
    isRedisConfigured.mockReset();
    ratelimitLimit.mockReset();
    slidingWindow.mockReset();

    getRedis.mockReturnValue({ get: redisGet, set: redisSet });
    isRedisConfigured.mockReturnValue(false);
    slidingWindow.mockReturnValue("sliding-window-limiter");
  });

  afterEach(() => {
    clearStorageEnv();
  });

  it("selects postgres when NEON_DATABASE_URL is set, even with redis also configured", async () => {
    vi.stubEnv("NEON_DATABASE_URL", "postgres://neon.example/db");
    isRedisConfigured.mockReturnValue(true);

    const kv = await importKv();
    expect(kv.getKvBackend()).toBe("postgres");
    expect(kv.isKvConfigured()).toBe(true);
  });

  it("selects postgres when only DATABASE_URL is set", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://generic.example/db");

    const kv = await importKv();
    expect(kv.getKvBackend()).toBe("postgres");
  });

  it("prefers NEON_DATABASE_URL over DATABASE_URL", async () => {
    vi.stubEnv("NEON_DATABASE_URL", "postgres://neon.example/db");
    vi.stubEnv("DATABASE_URL", "postgres://generic.example/db");
    neonQuery.mockResolvedValue([]);

    const kv = await importKv();
    await kv.kvGet("anything").catch(() => null);

    expect(neonConstructor).toHaveBeenCalledWith("postgres://neon.example/db");
  });

  it("selects redis when only the Upstash variables are configured", async () => {
    isRedisConfigured.mockReturnValue(true);

    const kv = await importKv();
    expect(kv.getKvBackend()).toBe("redis");
    expect(kv.isKvConfigured()).toBe(true);
  });

  it("is unconfigured when neither backend has environment variables", async () => {
    const kv = await importKv();
    expect(kv.getKvBackend()).toBeNull();
    expect(kv.isKvConfigured()).toBe(false);
  });

  it("mentions both backend options in the configuration message", async () => {
    const kv = await importKv();
    expect(kv.KV_CONFIGURATION_MESSAGE).toContain("NEON_DATABASE_URL");
    expect(kv.KV_CONFIGURATION_MESSAGE).toContain("UPSTASH_REDIS_REST_URL");
    expect(kv.KV_CONFIGURATION_MESSAGE).toContain("KV_REST_API_URL");
  });

  it("throws KvConfigurationError from every operation when unconfigured", async () => {
    const kv = await importKv();
    await expect(kv.kvGet("k")).rejects.toBeInstanceOf(kv.KvConfigurationError);
    await expect(kv.kvSet("k", "v", 60)).rejects.toBeInstanceOf(kv.KvConfigurationError);
    await expect(
      kv.kvSlidingWindowLimit({ prefix: "p", identifier: "i", limit: 1, windowMs: 1000 })
    ).rejects.toBeInstanceOf(kv.KvConfigurationError);
  });
});

describe("kv facade redis backend", () => {
  beforeEach(() => {
    neonQuery.mockReset();
    redisGet.mockReset();
    redisSet.mockReset();
    getRedis.mockReset();
    isRedisConfigured.mockReset();
    ratelimitLimit.mockReset();
    slidingWindow.mockReset();

    getRedis.mockReturnValue({ get: redisGet, set: redisSet });
    isRedisConfigured.mockReturnValue(true);
    slidingWindow.mockReturnValue("sliding-window-limiter");
  });

  afterEach(() => {
    clearStorageEnv();
  });

  it("passes strings through verbatim on read", async () => {
    redisGet.mockResolvedValueOnce("plain markdown");
    const kv = await importKv();

    expect(await kv.kvGet("project:abc")).toBe("plain markdown");
  });

  it("normalizes auto-deserialized objects back to canonical JSON", async () => {
    redisGet.mockResolvedValueOnce({ v: 1, markdown: "# Doc" });
    const kv = await importKv();

    expect(await kv.kvGet("project:abc")).toBe('{"v":1,"markdown":"# Doc"}');
  });

  it("normalizes auto-deserialized scalars back to canonical JSON text", async () => {
    redisGet.mockResolvedValueOnce(42);
    const kv = await importKv();
    expect(await kv.kvGet("project:abc")).toBe("42");
  });

  it("returns null for missing keys", async () => {
    redisGet.mockResolvedValueOnce(null);
    const kv = await importKv();
    expect(await kv.kvGet("project:abc")).toBeNull();
  });

  it("writes strings verbatim with the Redis EX TTL", async () => {
    const kv = await importKv();
    await kv.kvSet("project:abc", '{"v":1,"markdown":"x"}', 604800);

    expect(redisSet).toHaveBeenCalledWith(
      "project:abc",
      '{"v":1,"markdown":"x"}',
      { ex: 604800 }
    );
  });

  it("runs rate limiting through the unchanged Ratelimit sliding-window path", async () => {
    ratelimitLimit.mockResolvedValueOnce({
      success: true,
      limit: 30,
      remaining: 29,
      reset: 123456,
      pending: Promise.resolve(),
    });
    const kv = await importKv();

    const result = await kv.kvSlidingWindowLimit({
      prefix: "markdown-video:projects:read",
      identifier: "198.51.100.23",
      limit: 30,
      windowMs: 60_000,
    });

    expect(slidingWindow).toHaveBeenCalledWith(30, "60000 ms");
    expect(ratelimitLimit).toHaveBeenCalledWith("198.51.100.23");
    expect(result).toMatchObject({
      success: true,
      limit: 30,
      remaining: 29,
      reset: 123456,
    });
  });

  it("passes the timeout reason through from the Redis limiter", async () => {
    ratelimitLimit.mockResolvedValueOnce({
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
      reason: "timeout",
      pending: Promise.resolve(),
    });
    const kv = await importKv();

    const result = await kv.kvSlidingWindowLimit({
      prefix: "p",
      identifier: "i",
      limit: 30,
      windowMs: 60_000,
    });

    expect(result.reason).toBe("timeout");
  });
});

describe("kv facade postgres backend", () => {
  beforeEach(() => {
    neonConstructor.mockClear();
    neonQuery.mockReset();
    isRedisConfigured.mockReset();
    isRedisConfigured.mockReturnValue(false);
  });

  afterEach(() => {
    clearStorageEnv();
    vi.useRealTimers();
  });

  function stubPostgresEnv() {
    vi.stubEnv("NEON_DATABASE_URL", "postgres://neon.example/db");
  }

  it("bootstraps the schema lazily once before the first query", async () => {
    stubPostgresEnv();
    neonQuery.mockResolvedValue([]);
    const kv = await importKv();

    await kv.kvGet("some-key");
    await kv.kvGet("some-key");

    const statements = neonQuery.mock.calls.map(([text]) => text as string);
    expect(statements[0]).toMatch(/CREATE TABLE IF NOT EXISTS kv_store/);
    expect(statements[1]).toMatch(/CREATE INDEX IF NOT EXISTS kv_store_expires_at_idx/);
    expect(statements[2]).toMatch(/CREATE OR REPLACE FUNCTION kv_sliding_window_check/);
    // The second read does not repeat the bootstrap.
    expect(
      statements.filter((s) => s.includes("CREATE TABLE IF NOT EXISTS")).length
    ).toBe(1);
  });

  it("reads filter expired rows and decode utf8 values", async () => {
    stubPostgresEnv();
    neonQuery.mockImplementation(async (text: string) => {
      if ((text as string).trimStart().startsWith("SELECT convert_from")) {
        return [{ value: "stored-value" }];
      }
      return [];
    });
    const kv = await importKv();

    const value = await kv.kvGet("some-key");

    expect(value).toBe("stored-value");
    // The bootstrap function body also mentions convert_from, so match the
    // actual SELECT statement shape rather than the keyword alone.
    const select = neonQuery.mock.calls.find(([text]) =>
      (text as string).trimStart().startsWith("SELECT convert_from")
    );
    expect(select).toBeDefined();
    expect(select![0]).toMatch(/WHERE key = \$1 AND expires_at > now\(\)/);
    expect(select![1]).toEqual(["some-key"]);
  });

  it("writes with an upsert keyed on the primary key and a TTL-derived expiry", async () => {
    stubPostgresEnv();
    neonQuery.mockResolvedValue([]);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const kv = await importKv();

    await kv.kvSet("some-key", "some-value", 3600);

    // Bootstrap statements run with empty params; the real upsert always
    // carries key/value/ttl parameters.
    const upsert = neonQuery.mock.calls.find(
      ([text, params]) =>
        (text as string).trimStart().startsWith("INSERT INTO kv_store") &&
        (params as unknown[]).length > 0
    );
    expect(upsert![0]).toMatch(/ON CONFLICT \(key\) DO UPDATE/);
    expect(upsert![0]).toMatch(/interval '1 second'/);
    expect(upsert![1]).toEqual(["some-key", "some-value", 3600]);
    random.mockRestore();
  });

  it("prunes expired rows opportunistically when the probability hits", async () => {
    stubPostgresEnv();
    neonQuery.mockResolvedValue([]);
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const kv = await importKv();

    await kv.kvSet("some-key", "some-value", 3600);

    const prune = neonQuery.mock.calls.find(([text]) =>
      (text as string).includes("DELETE FROM kv_store")
    );
    expect(prune).toBeDefined();
    expect(prune![0]).toMatch(/DELETE FROM kv_store WHERE expires_at <= now\(\)/);
    random.mockRestore();
  });

  it("does not prune when the probability misses", async () => {
    stubPostgresEnv();
    neonQuery.mockResolvedValue([]);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
    const kv = await importKv();

    await kv.kvSet("some-key", "some-value", 3600);

    expect(
      neonQuery.mock.calls.some(([text]) => (text as string).includes("DELETE FROM kv_store"))
    ).toBe(false);
    random.mockRestore();
  });

  it("swallows prune failures instead of failing the write", async () => {
    stubPostgresEnv();
    neonQuery.mockImplementation(async (text: string) => {
      if ((text as string).includes("DELETE FROM kv_store")) {
        throw new Error("prune exploded");
      }
      return [];
    });
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const kv = await importKv();

    await expect(kv.kvSet("some-key", "some-value", 3600)).resolves.toBeUndefined();
    random.mockRestore();
    warn.mockRestore();
  });

  it("invokes the sliding-window function with the prefixed key and maps the result", async () => {
    stubPostgresEnv();
    const now = Date.now();
    neonQuery.mockImplementation(async (text: string) => {
      if ((text as string).trimStart().startsWith("SELECT allowed, remaining FROM kv_sliding_window_check(")) {
        return [{ allowed: true, remaining: 29 }];
      }
      return [];
    });
    const kv = await importKv();

    const result = await kv.kvSlidingWindowLimit({
      prefix: "markdown-video:projects:read",
      identifier: "198.51.100.23",
      limit: 30,
      windowMs: 60_000,
    });

    const call = neonQuery.mock.calls.find(([text]) =>
      (text as string).trimStart().startsWith("SELECT allowed, remaining FROM kv_sliding_window_check(")
    );
    expect(call).toBeDefined();
    const params = call![1] as unknown[];
    expect(params[0]).toBe("markdown-video:projects:read:198.51.100.23");
    expect(params[1]).toBeGreaterThanOrEqual(now);
    expect(params[2]).toBe(60_000);
    expect(params[3]).toBe(30);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(29);
    expect(result.limit).toBe(30);
    // Reset is the end of the fixed window containing now, matching the
    // @upstash/ratelimit computation.
    const expectedReset = (Math.floor(now / 60_000) + 1) * 60_000;
    expect(Math.abs(result.reset - expectedReset)).toBeLessThanOrEqual(60_000);
  });

  it("returns the synthetic timeout result when the backend is too slow", async () => {
    stubPostgresEnv();
    vi.useFakeTimers();
    // Bootstrap resolves, but the rate-limit query never does.
    neonQuery.mockImplementation(async (text: string) => {
      if ((text as string).trimStart().startsWith("SELECT allowed, remaining FROM kv_sliding_window_check(")) {
        return new Promise(() => undefined);
      }
      return [];
    });
    const kv = await importKv();

    const pending = kv.kvSlidingWindowLimit({
      prefix: "p",
      identifier: "i",
      limit: 30,
      windowMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(1_001);
    const result = await pending;

    expect(result.reason).toBe("timeout");
    expect(result.reset).toBe(0);
  });
});
