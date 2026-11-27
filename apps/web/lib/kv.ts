import { neon } from "@neondatabase/serverless";
import { Ratelimit } from "@upstash/ratelimit";

import {
  bootstrapPostgresKv,
  createPostgresKvStore,
  type PgQueryExecutor,
  type PostgresKvStore,
} from "@/lib/kv-postgres";
import { getRedis, isRedisConfigured } from "@/lib/redis";

/**
 * Storage facade for the app's three KV consumers: project share links,
 * rendered-video objects, and distributed rate limiting. Backend selection:
 *
 * 1. `NEON_DATABASE_URL` or `DATABASE_URL` present → Postgres (Neon serverless
 *    HTTP driver; see lib/kv-postgres.ts for the schema and semantics),
 * 2. else the existing Upstash/KV environment variables → the original Redis
 *    path, unchanged, so existing self-hosted deployments keep working,
 * 3. else unconfigured — consumers keep their documented fail-closed (or
 *    explicitly fail-open) behavior, exactly as when Redis was not configured.
 *
 * Values are plain strings across the facade: callers JSON-encode themselves,
 * and the Redis backend normalizes Upstash's automatic JSON deserialization
 * back to the canonical string form (see normalizeRedisValue).
 */

export const KV_CONFIGURATION_MESSAGE =
  "Storage is not configured. Set NEON_DATABASE_URL or DATABASE_URL for Postgres storage, or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN) for Redis storage.";

export class KvConfigurationError extends Error {
  constructor() {
    super(KV_CONFIGURATION_MESSAGE);
    this.name = "KvConfigurationError";
  }
}

export type KvBackend = "postgres" | "redis" | null;

function readPostgresConnectionString(): string | null {
  return process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || null;
}

export function getKvBackend(): KvBackend {
  if (readPostgresConnectionString()) {
    return "postgres";
  }
  if (isRedisConfigured()) {
    return "redis";
  }
  return null;
}

export function isKvConfigured(): boolean {
  return getKvBackend() !== null;
}

/* --------------------------------------------------------------------------
 * Postgres backend
 *
 * The Neon serverless driver speaks SQL over HTTP one-shot queries, so no
 * pool or session management is needed. The bootstrap (table + index +
 * rate-limit function) is idempotent and memoized per connection string: it
 * runs lazily on the first use of each cold-started process, and the memo is
 * reset if it rejects so a later request retries instead of caching failure.
 * ------------------------------------------------------------------------ */

const postgresStores = new Map<string, PostgresKvStore>();
const postgresBootstraps = new Map<string, Promise<void>>();

function createNeonExecutor(connectionString: string): PgQueryExecutor {
  const sql = neon(connectionString);
  return async (text, params) => {
    const rows = await sql.query(text, params as unknown[]);
    return rows as Array<Record<string, unknown>>;
  };
}

function getPostgresStore(connectionString: string): PostgresKvStore {
  const cached = postgresStores.get(connectionString);
  if (cached) {
    return cached;
  }
  const store = createPostgresKvStore(createNeonExecutor(connectionString));
  postgresStores.set(connectionString, store);
  return store;
}

function ensurePostgresBootstrapped(connectionString: string): Promise<void> {
  const cached = postgresBootstraps.get(connectionString);
  if (cached) {
    return cached;
  }
  const executor = createNeonExecutor(connectionString);
  const bootstrap = bootstrapPostgresKv(executor).catch((error) => {
    postgresBootstraps.delete(connectionString);
    throw error;
  });
  postgresBootstraps.set(connectionString, bootstrap);
  return bootstrap;
}

async function getBootstrappedPostgresStore(): Promise<PostgresKvStore> {
  const connectionString = readPostgresConnectionString();
  if (!connectionString) {
    throw new KvConfigurationError();
  }
  await ensurePostgresBootstrapped(connectionString);
  return getPostgresStore(connectionString);
}

/**
 * Lazy expiry means expired rows are never returned by reads, but they still
 * occupy storage until deleted. Every write path (kvSet and rate-limit
 * checks) issues a best-effort prune of all expired rows with probability
 * 1/50. Pruning is garbage collection only — correctness never depends on it
 * — so prune failures are swallowed after one warning, and the amortized cost
 * is a single indexed delete on a small fraction of writes. There is no
 * pg_cron or background sweeper by design.
 */
const PRUNE_PROBABILITY = 1 / 50;
let pruneWarningEmitted = false;

async function maybePruneExpired(store: PostgresKvStore): Promise<void> {
  if (Math.random() >= PRUNE_PROBABILITY) {
    return;
  }
  try {
    await store.pruneExpired();
  } catch (error) {
    if (!pruneWarningEmitted) {
      pruneWarningEmitted = true;
      console.warn(
        "[kv] opportunistic pruning of expired rows failed; lazy expiry still hides them.",
        error instanceof Error ? error.message : error
      );
    }
  }
}

/* --------------------------------------------------------------------------
 * Redis backend normalization
 * ------------------------------------------------------------------------ */

/**
 * The Upstash REST client stores strings verbatim but auto-deserializes GET
 * responses that look like JSON. The facade is string-oriented, so objects,
 * numbers, and booleans are re-serialized. This is exact for the only shape
 * this app writes through the facade — canonical `JSON.stringify` output —
 * and legacy plain-string entries pass through untouched.
 */
function normalizeRedisValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (
    typeof value === "object" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  return null;
}

/* --------------------------------------------------------------------------
 * get / set
 * ------------------------------------------------------------------------ */

export async function kvGet(key: string): Promise<string | null> {
  const backend = getKvBackend();
  if (backend === "postgres") {
    const store = await getBootstrappedPostgresStore();
    return store.get(key);
  }
  if (backend === "redis") {
    const value: unknown = await getRedis().get(key);
    return normalizeRedisValue(value);
  }
  throw new KvConfigurationError();
}

export async function kvSet(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  const backend = getKvBackend();
  if (backend === "postgres") {
    const store = await getBootstrappedPostgresStore();
    await store.set(key, value, ttlSeconds);
    await maybePruneExpired(store);
    return;
  }
  if (backend === "redis") {
    await getRedis().set(key, value, { ex: ttlSeconds });
    return;
  }
  throw new KvConfigurationError();
}

/* --------------------------------------------------------------------------
 * Atomic sliding-window rate limiting
 * ------------------------------------------------------------------------ */

export type SlidingWindowResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds at which the current window ends. */
  reset: number;
  reason?: string;
};

/**
 * Mirrors the timeout behavior of `@upstash/ratelimit` (whose `timeout`
 * option is configured to the same value in rate-limit.ts): if the backend
 * does not answer in time the caller receives a synthetic `reason: "timeout"`
 * result instead of an exception, and rate-limit.ts applies the policy's
 * failure mode. The underlying query is not cancelled — same as the Redis
 * path, where the Lua script continues server-side.
 */
const RATE_LIMIT_BACKEND_TIMEOUT_MS = 1_000;

function timeoutResult(): SlidingWindowResult {
  return {
    success: true,
    limit: 0,
    remaining: 0,
    reset: 0,
    reason: "timeout",
  };
}

async function withTimeout(
  operation: Promise<SlidingWindowResult>
): Promise<SlidingWindowResult> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<SlidingWindowResult>((resolve) => {
      timeoutId = setTimeout(() => resolve(timeoutResult()), RATE_LIMIT_BACKEND_TIMEOUT_MS);
    });
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/* Redis path: identical construction to the pre-facade implementation — same
 * Ratelimit class, same per-prefix caching, same 1s timeout — so the Lua
 * sliding-window script and its exact window semantics are unchanged. */
const redisLimiters = new Map<
  string,
  { redisClient: ReturnType<typeof getRedis>; limiter: Ratelimit }
>();

function getRedisLimiter(
  cacheKey: string,
  prefix: string,
  limit: number,
  windowMs: number
): Ratelimit {
  const redisClient = getRedis();
  const cached = redisLimiters.get(cacheKey);
  if (cached?.redisClient === redisClient) {
    return cached.limiter;
  }

  const limiter = new Ratelimit({
    redis: redisClient,
    // The window parser accepts millisecond strings verbatim, so the exact
    // millisecond window round-trips without unit-conversion drift.
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    prefix,
    timeout: RATE_LIMIT_BACKEND_TIMEOUT_MS,
  });
  redisLimiters.set(cacheKey, { redisClient, limiter });
  return limiter;
}

async function redisSlidingWindowLimit(args: {
  prefix: string;
  identifier: string;
  limit: number;
  windowMs: number;
}): Promise<SlidingWindowResult> {
  const cacheKey = `${args.prefix} ${args.limit} ${args.windowMs}`;
  const limiter = getRedisLimiter(cacheKey, args.prefix, args.limit, args.windowMs);
  const result = await limiter.limit(args.identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    ...(result.reason ? { reason: result.reason } : {}),
  };
}

/**
 * Postgres path: one HTTP round trip to the server-side function documented
 * in lib/kv-postgres.ts, which reproduces the Redis Lua script's semantics —
 * weighted previous-window bleed, deny-at-limit without incrementing, and
 * 2x-window-plus-1s expiry — with row-lock serialization instead of script
 * atomicity. `reset` is computed identically to `@upstash/ratelimit`: the end
 * of the fixed window containing `now`.
 */
async function postgresSlidingWindowLimit(args: {
  prefix: string;
  identifier: string;
  limit: number;
  windowMs: number;
}): Promise<SlidingWindowResult> {
  const now = Date.now();
  const operation = (async (): Promise<SlidingWindowResult> => {
    const store = await getBootstrappedPostgresStore();
    const result = await store.slidingWindowCheck({
      key: `${args.prefix}:${args.identifier}`,
      nowMs: now,
      windowMs: args.windowMs,
      limit: args.limit,
    });
    await maybePruneExpired(store);
    const remaining = result.allowed ? result.remaining : 0;
    return {
      success: result.allowed,
      limit: args.limit,
      remaining,
      reset: (Math.floor(now / args.windowMs) + 1) * args.windowMs,
    };
  })();
  return withTimeout(operation);
}

export async function kvSlidingWindowLimit(args: {
  prefix: string;
  identifier: string;
  limit: number;
  windowMs: number;
}): Promise<SlidingWindowResult> {
  const backend = getKvBackend();
  if (backend === "postgres") {
    return postgresSlidingWindowLimit(args);
  }
  if (backend === "redis") {
    return redisSlidingWindowLimit(args);
  }
  throw new KvConfigurationError();
}
