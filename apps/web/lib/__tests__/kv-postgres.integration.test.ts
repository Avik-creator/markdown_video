/**
 * Integration tests for the Postgres KV backend against a real PostgreSQL 16
 * server. They run only when KV_TEST_POSTGRES_URL points at a database (a
 * dockerized `postgres:16` locally, a service container in CI):
 *
 *   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
 *   KV_TEST_POSTGRES_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm test
 *
 * The tests exercise the exact SQL shipped to production through the same
 * createPostgresKvStore/bootstrapPostgresKv code paths, with a node-postgres
 * transport substituted for the Neon serverless HTTP transport. The Neon
 * driver's one-shot queries and node-postgres use identical positional
 * parameter syntax and row shapes, so the query text, the plpgsql function,
 * and the concurrency semantics under test are the production ones; the
 * transport substitution is the only difference (and the Neon transport
 * itself is covered by the separate real-Neon smoke test).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import {
  KV_BOOTSTRAP_STATEMENTS,
  bootstrapPostgresKv,
  createPostgresKvStore,
  type PgQueryExecutor,
} from "../kv-postgres";

const connectionString = process.env.KV_TEST_POSTGRES_URL;
const describeWithPostgres = connectionString ? describe : describe.skip;

let pool: pg.Pool | undefined;
let execute: PgQueryExecutor;

function uniqueKey(testLabel: string) {
  return `test:${testLabel}:${Math.random().toString(36).slice(2)}`;
}

beforeAll(async () => {
  if (!connectionString) {
    return;
  }
  pool = new pg.Pool({ connectionString, max: 8 });
  execute = async (text, params) => {
    const result = await pool!.query(text, params as unknown[]);
    return result.rows as Array<Record<string, unknown>>;
  };
  // Start from a clean slate so bootstrap and expiry behavior are observable.
  await execute("DROP TABLE IF EXISTS kv_store", []);
  await bootstrapPostgresKv(execute);
}, 30_000);

afterAll(async () => {
  if (pool) {
    await execute("DROP TABLE IF EXISTS kv_store", []).catch(() => undefined);
    await pool.end();
  }
});

describeWithPostgres("kv postgres integration", () => {
  it("bootstraps idempotently", async () => {
    await expect(bootstrapPostgresKv(execute)).resolves.toBeUndefined();
    expect(KV_BOOTSTRAP_STATEMENTS.length).toBe(3);

    const table = await execute(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'kv_store' ORDER BY ordinal_position`,
      []
    );
    expect(table).toEqual([
      { column_name: "key", data_type: "text" },
      { column_name: "value", data_type: "bytea" },
      { column_name: "expires_at", data_type: "timestamp with time zone" },
    ]);
  });

  it("round-trips utf8 values including multibyte characters", async () => {
    const store = createPostgresKvStore(execute);
    const key = uniqueKey("utf8");
    const value = JSON.stringify({ markdown: "# Héllo 🎬 — emoji and accents" });

    await store.set(key, value, 3600);
    expect(await store.get(key)).toBe(value);
  });

  it("overwrites existing keys and refreshes the expiry", async () => {
    const store = createPostgresKvStore(execute);
    const key = uniqueKey("overwrite");

    await store.set(key, "first", 3600);
    await store.set(key, "second", 3600);
    expect(await store.get(key)).toBe("second");

    const rows = await execute(`SELECT count(*) AS n FROM kv_store WHERE key = $1`, [key]);
    expect(Number(rows[0]!.n)).toBe(1);
  });

  it("returns null for missing keys", async () => {
    const store = createPostgresKvStore(execute);
    expect(await store.get(uniqueKey("missing"))).toBeNull();
  });

  it("hides expired rows from reads while keeping them physically until pruned", async () => {
    const store = createPostgresKvStore(execute);
    const key = uniqueKey("expiry");

    // Insert a row whose expiry is already past, as if its TTL elapsed.
    await execute(
      `INSERT INTO kv_store (key, value, expires_at)
       VALUES ($1, convert_to($2, 'UTF8'), now() - interval '1 second')`,
      [key, "expired-value"]
    );

    // Lazy expiry: the read filters it out even though the row still exists.
    expect(await store.get(key)).toBeNull();
    const before = await execute(`SELECT count(*) AS n FROM kv_store WHERE key = $1`, [key]);
    expect(Number(before[0]!.n)).toBe(1);

    // Pruning physically removes it.
    await store.pruneExpired();
    const after = await execute(`SELECT count(*) AS n FROM kv_store WHERE key = $1`, [key]);
    expect(Number(after[0]!.n)).toBe(0);
  });

  it("round-trips binary mp4 payloads byte-exactly through the render-storage format", async () => {
    const store = createPostgresKvStore(execute);
    const key = uniqueKey("mp4");

    // 512 KiB of random bytes covers every possible byte value with high
    // probability and exercises the base64-in-JSON payload shape that
    // render-storage writes.
    const mp4 = new Uint8Array(512 * 1024);
    for (let i = 0; i < mp4.length; i++) {
      mp4[i] = Math.floor(Math.random() * 256);
    }
    const storedPayload = JSON.stringify({
      v: 1,
      encoding: "base64",
      contentType: "video/mp4",
      data: Buffer.from(mp4).toString("base64"),
      sizeBytes: mp4.byteLength,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });

    await store.set(key, storedPayload, 3600);
    const raw = await store.get(key);
    expect(raw).toBe(storedPayload);

    const parsed = JSON.parse(raw!) as { data: string; sizeBytes: number };
    const decoded = Buffer.from(parsed.data, "base64");
    expect(decoded.byteLength).toBe(mp4.byteLength);
    expect(Buffer.compare(decoded, Buffer.from(mp4))).toBe(0);
  });

  it("enforces the sliding-window limit exactly under sequential checks", async () => {
    const store = createPostgresKvStore(execute);
    const key = uniqueKey("sw-sequential");
    const windowMs = 60_000;
    const limit = 5;
    // Aligned synthetic timestamps make the test independent of wall-clock
    // window boundaries.
    const base = Math.floor(Date.now() / windowMs) * windowMs + 1_000;

    const outcomes: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const result = await store.slidingWindowCheck({
        key,
        nowMs: base + i * 100,
        windowMs,
        limit,
      });
      outcomes.push(result.allowed);
    }

    expect(outcomes).toEqual([true, true, true, true, true, false, false]);
  });

  it("does not increment the counter for denied requests", async () => {
    const store = createPostgresKvStore(execute);
    const key = uniqueKey("sw-denied");
    const windowMs = 60_000;
    const limit = 3;
    const base = Math.floor(Date.now() / windowMs) * windowMs + 1_000;

    for (let i = 0; i < 3; i++) {
      await store.slidingWindowCheck({ key, nowMs: base + i, windowMs, limit });
    }
    for (let i = 0; i < 4; i++) {
      const denied = await store.slidingWindowCheck({ key, nowMs: base + 100 + i, windowMs, limit });
      expect(denied.allowed).toBe(false);
      expect(denied.remaining).toBe(0);
    }

    const rows = await execute(
      `SELECT convert_from(value, 'UTF8') AS state FROM kv_store WHERE key = $1`,
      [key]
    );
    const state = JSON.parse(rows[0]!.state as string) as { c: number };
    // Denied requests must not inflate the count — otherwise end-of-window
    // hammering would bleed phantom usage into the next window, diverging
    // from the Redis implementation.
    expect(state.c).toBe(3);
  });

  it("bleeds the weighted previous-window count into the next window", async () => {
    const store = createPostgresKvStore(execute);
    const key = uniqueKey("sw-rollover");
    const windowMs = 60_000;
    const limit = 4;
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;

    // Fill the first window entirely (4 of 4).
    for (let i = 0; i < 4; i++) {
      const result = await store.slidingWindowCheck({
        key,
        nowMs: windowStart + 1_000 + i,
        windowMs,
        limit,
      });
      expect(result.allowed).toBe(true);
    }

    // Exactly halfway into the next window the weighted previous count is
    // floor((1 - 0.5) * 4) = 2, so exactly 2 more requests pass. All three
    // checks share one timestamp: even a millisecond later the floor of the
    // weighted count steps down (matching the Lua implementation), which is
    // not what this test isolates.
    const halfIntoNext = windowStart + windowMs + windowMs / 2;
    const first = await store.slidingWindowCheck({ key, nowMs: halfIntoNext, windowMs, limit });
    const second = await store.slidingWindowCheck({ key, nowMs: halfIntoNext, windowMs, limit });
    const third = await store.slidingWindowCheck({ key, nowMs: halfIntoNext, windowMs, limit });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });

  it("forgets usage entirely after more than a full window of silence", async () => {
    const store = createPostgresKvStore(execute);
    const key = uniqueKey("sw-forget");
    const windowMs = 60_000;
    const limit = 2;
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;

    for (let i = 0; i < 2; i++) {
      await store.slidingWindowCheck({ key, nowMs: windowStart + i, windowMs, limit });
    }
    const denied = await store.slidingWindowCheck({ key, nowMs: windowStart + 10, windowMs, limit });
    expect(denied.allowed).toBe(false);

    // Two full windows later nothing bleeds: the full budget is back.
    const muchLater = windowStart + 2 * windowMs + 1;
    const fresh = await store.slidingWindowCheck({ key, nowMs: muchLater, windowMs, limit });
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(limit - 1);
  });

  it("serializes concurrent checks so exactly `limit` requests pass", async () => {
    const store = createPostgresKvStore(execute);
    const key = uniqueKey("sw-concurrency");
    const windowMs = 3_600_000;
    const limit = 20;
    const totalRequests = 50;
    const nowMs = Math.floor(Date.now() / windowMs) * windowMs + 500;

    // Promise.all over a connection pool: overlapping transactions on
    // separate connections contend for the same state row, so this fails
    // unless the check+increment decision is atomic per identifier.
    const results = await Promise.all(
      Array.from({ length: totalRequests }, () =>
        store.slidingWindowCheck({ key, nowMs, windowMs, limit })
      )
    );

    const allowed = results.filter((r) => r.allowed).length;
    const denied = results.filter((r) => !r.allowed).length;
    expect(allowed).toBe(limit);
    expect(denied).toBe(totalRequests - limit);
  }, 30_000);

  it("keeps counters independent per identifier and per policy prefix", async () => {
    const store = createPostgresKvStore(execute);
    const keyA = uniqueKey("sw-a");
    const keyB = uniqueKey("sw-b");
    const windowMs = 60_000;
    const limit = 1;
    const nowMs = Math.floor(Date.now() / windowMs) * windowMs + 100;

    expect((await store.slidingWindowCheck({ key: keyA, nowMs, windowMs, limit })).allowed).toBe(true);
    expect((await store.slidingWindowCheck({ key: keyA, nowMs: nowMs + 1, windowMs, limit })).allowed).toBe(false);
    // A different identifier (or a different policy prefix) has its own budget.
    expect((await store.slidingWindowCheck({ key: keyB, nowMs, windowMs, limit })).allowed).toBe(true);
  });
});
