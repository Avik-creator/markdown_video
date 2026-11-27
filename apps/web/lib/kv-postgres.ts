/**
 * Postgres backend for the KV facade (lib/kv.ts). Values are stored as bytea
 * in a single table with lazy expiry: reads filter `expires_at > now()` and
 * expired rows are pruned opportunistically on write paths (see kv.ts). There
 * is no migration framework — `bootstrapPostgresKv` is idempotent and runs
 * lazily once per cold start.
 *
 * The query executor interface is intentionally minimal so the exact same SQL
 * can run over the Neon serverless HTTP transport in production (see kv.ts)
 * and over a plain `pg` client against dockerized Postgres in integration
 * tests. Both transports speak positional `$n` parameters and return rows as
 * plain objects. All values cross the wire as text: writes use
 * `convert_to($n, 'UTF8')` and reads use `convert_from(value, 'UTF8')`, so no
 * transport-specific bytea decoding is ever involved.
 */

export type PgQueryExecutor = (
  text: string,
  params: readonly unknown[]
) => Promise<Array<Record<string, unknown>>>;

/**
 * The sliding-window rate-limit check mirrors the atomic Lua script that
 * `@upstash/ratelimit` runs on Redis (see lib/rate-limit.ts for the policies):
 *
 * - counters are bucketed per fixed window, and the previous window's count
 *   bleeds into the current one weighted by `floor((1 - pct) * prevCount)`,
 * - a request is denied when `weightedPrevious + currentCount >= limit` and
 *   denied requests do not increment the counter,
 * - keys expire after `2 * window + 1s`.
 *
 * Where Redis keys are per-window buckets (`identifier:windowNumber`), this
 * implementation keeps one row per identifier holding a small JSON state
 * `{w, c, p}` (window number, count, previous-window count) and performs the
 * window rollover inside the same atomic unit. The single row means every
 * check locks exactly one row, so concurrent checks for one identifier
 * serialize on that row lock while different identifiers never block each
 * other, and deadlocks are impossible by construction.
 *
 * Atomicity: the whole function executes inside the single statement's
 * implicit transaction. The INSERT-then-SELECT-FOR-UPDATE pair guarantees the
 * row exists and is exclusively locked before the decision is computed, so
 * concurrent executions cannot interleave reads and writes. Expiry is
 * garbage-collection only: an expired row's state is always at least two
 * windows stale, which the rollover logic reduces to the same fresh state a
 * deleted row would produce, so lazy expiry never affects correctness.
 */
export const KV_SLIDING_WINDOW_FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION kv_sliding_window_check(
  p_key text,
  p_now_ms double precision,
  p_window_ms double precision,
  p_limit integer
) RETURNS TABLE(allowed boolean, remaining integer) LANGUAGE plpgsql AS $func$
DECLARE
  v_state text;
  v_w double precision;
  v_c integer;
  v_p integer;
  v_cur_window double precision;
  v_pct double precision;
  v_weighted_prev integer;
  v_allowed boolean;
  v_ttl_seconds double precision;
BEGIN
  v_cur_window := floor(p_now_ms / p_window_ms);
  v_pct := (p_now_ms - v_cur_window * p_window_ms) / p_window_ms;
  -- Same TTL as the Redis implementation: enough time for a bucket to overlap
  -- with the following window, plus one second of slack.
  v_ttl_seconds := (2.0 * p_window_ms + 1000.0) / 1000.0;

  INSERT INTO kv_store (key, value, expires_at)
  VALUES (
    p_key,
    convert_to('{"w":-1,"c":0,"p":0}', 'UTF8'),
    now() + v_ttl_seconds * interval '1 second'
  )
  ON CONFLICT (key) DO NOTHING;

  SELECT convert_from(value, 'UTF8') INTO v_state
  FROM kv_store
  WHERE key = p_key
  FOR UPDATE;

  -- The row always exists after the insert-or-conflict above. The only way it
  -- can be missing is a concurrent opportunistic prune deleting an already
  -- expired row in the microseconds between the two statements; expired state
  -- is at least two windows stale and therefore equivalent to fresh state, so
  -- falling back to the initial values is exact, not approximate.
  IF v_state IS NULL THEN
    v_w := -1;
    v_c := 0;
    v_p := 0;
  ELSE
    v_w := coalesce((v_state::jsonb ->> 'w')::double precision, -1);
    v_c := coalesce((v_state::jsonb ->> 'c')::integer, 0);
    v_p := coalesce((v_state::jsonb ->> 'p')::integer, 0);
  END IF;

  IF v_w = v_cur_window THEN
    NULL; -- state already belongs to the current window
  ELSIF v_w = v_cur_window - 1 THEN
    -- The stored count belongs to the window that just ended: it becomes the
    -- weighted previous-window baseline and the current count restarts.
    v_p := v_c;
    v_c := 0;
    v_w := v_cur_window;
  ELSIF v_w < v_cur_window - 1 THEN
    -- Older than one full window: nothing bleeds into the current window.
    v_p := 0;
    v_c := 0;
    v_w := v_cur_window;
  END IF;
  -- v_w > v_cur_window means a clock-skewed peer instance wrote state for a
  -- window this instance considers future. The Redis implementation has the
  -- same client-clock exposure; keeping the state untouched matches it.

  v_weighted_prev := floor((1.0 - v_pct) * v_p)::integer;

  IF v_weighted_prev + v_c >= p_limit THEN
    v_allowed := false;
  ELSE
    v_c := v_c + 1;
    v_allowed := true;
  END IF;

  INSERT INTO kv_store (key, value, expires_at)
  VALUES (
    p_key,
    convert_to(json_build_object('w', v_w, 'c', v_c, 'p', v_p)::text, 'UTF8'),
    now() + v_ttl_seconds * interval '1 second'
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      expires_at = EXCLUDED.expires_at;

  allowed := v_allowed;
  remaining := greatest(p_limit - v_weighted_prev - v_c, 0);
  RETURN NEXT;
END;
$func$
`;

/** Idempotent bootstrap statements, executed in order once per cold start. */
export const KV_BOOTSTRAP_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS kv_store (
    key text PRIMARY KEY,
    value bytea NOT NULL,
    expires_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS kv_store_expires_at_idx ON kv_store (expires_at)`,
  KV_SLIDING_WINDOW_FUNCTION_SQL,
];

export async function bootstrapPostgresKv(execute: PgQueryExecutor): Promise<void> {
  for (const statement of KV_BOOTSTRAP_STATEMENTS) {
    await execute(statement, []);
  }
}

export type PostgresKvStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  pruneExpired(): Promise<void>;
  slidingWindowCheck(args: {
    key: string;
    nowMs: number;
    windowMs: number;
    limit: number;
  }): Promise<{ allowed: boolean; remaining: number }>;
};

export function createPostgresKvStore(execute: PgQueryExecutor): PostgresKvStore {
  return {
    async get(key) {
      const rows = await execute(
        `SELECT convert_from(value, 'UTF8') AS value
         FROM kv_store
         WHERE key = $1 AND expires_at > now()`,
        [key]
      );
      const row = rows[0];
      if (!row || typeof row.value !== "string") {
        return null;
      }
      return row.value;
    },

    async set(key, value, ttlSeconds) {
      await execute(
        `INSERT INTO kv_store (key, value, expires_at)
         VALUES ($1, convert_to($2, 'UTF8'), now() + $3 * interval '1 second')
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             expires_at = EXCLUDED.expires_at`,
        [key, value, ttlSeconds]
      );
    },

    async pruneExpired() {
      await execute(`DELETE FROM kv_store WHERE expires_at <= now()`, []);
    },

    async slidingWindowCheck({ key, nowMs, windowMs, limit }) {
      const rows = await execute(
        `SELECT allowed, remaining FROM kv_sliding_window_check($1, $2, $3, $4)`,
        [key, nowMs, windowMs, limit]
      );
      const row = rows[0];
      if (!row) {
        throw new Error("kv_sliding_window_check returned no rows");
      }
      return {
        allowed: row.allowed === true,
        remaining: typeof row.remaining === "number" ? row.remaining : 0,
      };
    },
  };
}
