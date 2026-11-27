import type { Duration } from "@upstash/ratelimit";
import { isKvConfigured, kvSlidingWindowLimit } from "@/lib/kv";

export type RateLimitFailureMode = "fail-closed" | "fail-open";

/** The small request shape needed to identify a caller. Server components can
 * provide only the incoming headers, while route handlers normally pass the
 * whole Request (which is structurally compatible). */
export type RateLimitRequestLike = {
  headers: Pick<Headers, "get">;
};

export type RateLimitPolicy = {
  prefix: string;
  limit: number;
  window: Duration;
  failureMode: RateLimitFailureMode;
  /**
   * Explicit opt-in degraded limiter for fail-open policies. Without this
   * property, fail-open remains fully open when distributed limiting is down.
   */
  processMemoryFallback?: {
    maxIdentifiers: number;
  };
};

const MEMORY_FALLBACK_MAX_IDENTIFIERS = 5_000;

/**
 * Read policy for project lookups: GET /api/projects and the editor page's
 * shared-project resolution. Project loading depends on the same storage
 * backend as rate limiting, so there is no useful degraded mode when that
 * backend cannot be reached: fail closed.
 */
export const PROJECTS_READ_RATE_LIMIT: RateLimitPolicy = {
  prefix: "markdown-video:projects:read",
  limit: 30,
  window: "1 m",
  failureMode: "fail-closed",
};

/**
 * Write policy for project creation: POST /api/projects. Each accepted write
 * stores up to 1 MiB with a 7-day TTL, so writes get a much tighter budget
 * than reads — without one, a single IP could fill a small storage plan
 * within minutes. The read and write policies use separate prefixes so their
 * counters never interfere. Writes depend on the same storage backend as rate
 * limiting, so there is no useful degraded mode when it cannot be reached:
 * fail closed.
 */
export const PROJECTS_WRITE_RATE_LIMIT: RateLimitPolicy = {
  prefix: "markdown-video:projects:write",
  limit: 10,
  window: "1 h",
  failureMode: "fail-closed",
};

/**
 * MCP tools are read-only documentation/validation/parser operations and do not
 * otherwise require the storage backend. The documented behavior for this
 * policy is therefore a fail-open availability posture: if the optional
 * rate-limit storage dependency is missing, times out, or errors, requests
 * remain available, but each warm process applies a bounded in-memory
 * fixed-window fallback at the same per-IP limit instead of becoming
 * completely unthrottled.
 *
 * That fallback is explicitly best effort. It is process-local (serverless
 * instances and cold restarts do not share counters), uses fixed rather than
 * sliding windows, can be bypassed by rotating or spoofed source IPs, and evicts
 * least-recently-used identifiers when its bounded table is full. It is still a
 * useful degraded control for the common case of repeated traffic from one
 * client to one warm instance. Use fail-closed for any future MCP tool that
 * performs writes or expensive work.
 */
export const MCP_RATE_LIMIT: RateLimitPolicy = {
  prefix: "markdown-video:mcp",
  limit: 60,
  window: "1 m",
  failureMode: "fail-open",
  processMemoryFallback: {
    maxIdentifiers: MEMORY_FALLBACK_MAX_IDENTIFIERS,
  },
};

/**
 * Preview rendering is real Chromium CPU work but only captures 3–6 frames.
 * Ten requests per IP per hour is enough for iterative agent use while making
 * scripted abuse expensive. Unlike the read-only MCP policy this is fail-closed:
 * if distributed limiting is unavailable, expensive rendering must stop rather
 * than silently degrade to process-local or unthrottled behavior.
 */
export const MCP_RENDER_PREVIEW_RATE_LIMIT: RateLimitPolicy = {
  prefix: "markdown-video:mcp:render-preview",
  limit: 10,
  window: "1 h",
  failureMode: "fail-closed",
};

/**
 * Video rendering can mean hundreds of screenshots plus x264 encoding (often
 * 5–30 seconds of CPU), so it receives half the preview allowance. The prefix
 * is deliberately distinct from preview and general MCP counters.
 */
export const MCP_RENDER_VIDEO_RATE_LIMIT: RateLimitPolicy = {
  prefix: "markdown-video:mcp:render-video",
  limit: 5,
  window: "1 h",
  failureMode: "fail-closed",
};

/**
 * Video players commonly issue several range requests for one playback. 120
 * requests/minute is generous for legitimate playback while still bounding
 * repeated storage reads; failures are closed because the object store is the
 * same storage dependency and oversized artifacts cost bandwidth.
 */
export const RENDERS_READ_RATE_LIMIT: RateLimitPolicy = {
  prefix: "markdown-video:renders:read",
  limit: 120,
  window: "1 m",
  failureMode: "fail-closed",
};

const RETRY_AFTER_UNAVAILABLE_SECONDS = "30";
const MAX_IP_HEADER_LENGTH = 128;

type MemoryFallbackEntry = {
  count: number;
  reset: number;
};

const memoryFallbacks = new Map<string, Map<string, MemoryFallbackEntry>>();
const warningsOnce = new Set<string>();

function durationToMilliseconds(duration: Duration): number {
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)$/.exec(duration);
  if (!match) {
    throw new RangeError(`Unsupported rate-limit duration: ${duration}`);
  }

  const multipliers = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  } as const;
  const milliseconds =
    Number(match[1]) * multipliers[match[2] as keyof typeof multipliers];

  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new RangeError(`Rate-limit duration must be positive: ${duration}`);
  }
  return milliseconds;
}

function normalizeIpCandidate(candidate: string | null | undefined): string | null {
  const normalized = candidate?.trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, MAX_IP_HEADER_LENGTH);
}

function firstForwardedCandidate(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }
  for (const candidate of headerValue.split(",")) {
    const ip = normalizeIpCandidate(candidate);
    if (ip) {
      return ip;
    }
  }
  return null;
}

/**
 * Extracts the client IP from forwarding headers, in decreasing order of
 * trustworthiness:
 *
 * 1. `x-vercel-forwarded-for` — on Vercel this header is set by the platform's
 *    edge network to the connecting client's IP and a client-supplied value
 *    cannot survive, so it is the only header that stays trustworthy even if
 *    another proxy fronts the deployment (in which case `x-forwarded-for` may
 *    have been overwritten by that proxy). See
 *    https://vercel.com/docs/headers/request-headers
 * 2. `x-real-ip` — identical to `x-forwarded-for` on Vercel, and set by some
 *    reverse proxies to the immediate client address.
 * 3. Leftmost `x-forwarded-for` entry — the original client only when every
 *    proxy in front appends (rather than passes through) client-supplied
 *    values.
 *
 * Residual caveat: when self-hosting without an edge layer or reverse proxy
 * that strips/overwrites client-supplied forwarding headers, ALL of these
 * headers — including `x-vercel-forwarded-for`, which is only special on
 * Vercel — are trivially spoofable, so per-IP rate limiting is best-effort in
 * that deployment mode.
 */
export function getClientIp(request: RateLimitRequestLike): string {
  const vercelForwardedFor = firstForwardedCandidate(
    request.headers.get("x-vercel-forwarded-for")
  );
  if (vercelForwardedFor) {
    return vercelForwardedFor;
  }

  const realIp = normalizeIpCandidate(request.headers.get("x-real-ip"));
  if (realIp) {
    return realIp;
  }

  return firstForwardedCandidate(request.headers.get("x-forwarded-for")) ?? "unknown";
}

function jsonError(error: string, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

function rateLimitUnavailableResponse() {
  return jsonError("Rate limiting is unavailable", 503, {
    "retry-after": RETRY_AFTER_UNAVAILABLE_SECONDS,
  });
}

function rateLimitExceededResponse(result: {
  limit: number;
  remaining: number;
  reset: number;
}) {
  const millisecondsUntilReset = result.reset - Date.now();
  const retryAfterSeconds = result.reset > 0
    ? Math.max(1, Math.ceil(millisecondsUntilReset / 1_000))
    : Number(RETRY_AFTER_UNAVAILABLE_SECONDS);
  const resetUnixSeconds = result.reset > 0 ? Math.ceil(result.reset / 1_000) : 0;

  return jsonError("Rate limit exceeded", 429, {
    "retry-after": String(retryAfterSeconds),
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(Math.max(0, result.remaining)),
    "x-ratelimit-reset": String(resetUnixSeconds),
  });
}

function enforceProcessMemoryFallback(
  policy: RateLimitPolicy,
  identifier: string
): Response | null {
  const maxIdentifiers = policy.processMemoryFallback?.maxIdentifiers;
  if (maxIdentifiers === undefined) {
    return null;
  }

  const now = Date.now();
  let entries = memoryFallbacks.get(policy.prefix);
  if (!entries) {
    entries = new Map();
    memoryFallbacks.set(policy.prefix, entries);
  }

  // The table is small and bounded, so an opportunistic sweep keeps expired
  // identifiers from consuming memory without needing a timer (which is also
  // unreliable in short-lived serverless invocations).
  for (const [key, entry] of entries) {
    if (entry.reset <= now) {
      entries.delete(key);
    }
  }

  let entry = entries.get(identifier);
  if (entry) {
    // Reinserting maintains least-recently-used ordering in the Map.
    entries.delete(identifier);
    entries.set(identifier, entry);
  } else {
    if (entries.size >= maxIdentifiers) {
      const oldestIdentifier = entries.keys().next().value as string | undefined;
      if (oldestIdentifier !== undefined) {
        entries.delete(oldestIdentifier);
      }
    }

    entry = {
      count: 0,
      reset: now + durationToMilliseconds(policy.window),
    };
    entries.set(identifier, entry);
  }

  entry.count += 1;
  if (entry.count > policy.limit) {
    return rateLimitExceededResponse({
      limit: policy.limit,
      remaining: 0,
      reset: entry.reset,
    });
  }

  return null;
}

function warnOnce(key: string, message: string, context: Record<string, unknown>) {
  if (warningsOnce.has(key)) {
    return;
  }
  warningsOnce.add(key);
  console.warn(message, context);
}

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function handleRateLimitUnavailable(
  policy: RateLimitPolicy,
  cause: "missing-config" | "setup-error" | "timeout" | "check-error",
  identifier: string,
  error?: unknown
) {
  const context = {
    policy: policy.prefix,
    cause,
    error: error === undefined ? undefined : serializeError(error),
  };

  if (policy.failureMode === "fail-closed") {
    warnOnce(
      `closed:${policy.prefix}:${cause}`,
      `[rate-limit] ${policy.prefix} is unavailable; failing closed.`,
      context
    );
    return rateLimitUnavailableResponse();
  }

  if (!policy.processMemoryFallback) {
    warnOnce(
      `open:${policy.prefix}:${cause}`,
      `[rate-limit] ${policy.prefix} is unavailable; using documented fail-open behavior and allowing the request.`,
      context
    );
    return null;
  }

  warnOnce(
    `open:${policy.prefix}:${cause}`,
    `[rate-limit] ${policy.prefix} is unavailable; using documented fail-open behavior with a bounded process-local fallback.`,
    context
  );
  return enforceProcessMemoryFallback(policy, identifier);
}

/**
 * Returns null when the request may proceed, or a ready-to-return Response for
 * 429/503. Failure behavior is explicit in each RateLimitPolicy; in particular,
 * MCP's fail-open-with-process-local-fallback behavior is documented at
 * MCP_RATE_LIMIT above.
 */
export async function enforceRateLimit(
  request: RateLimitRequestLike,
  policy: RateLimitPolicy
): Promise<Response | null> {
  const identifier = getClientIp(request);

  if (!isKvConfigured()) {
    return handleRateLimitUnavailable(policy, "missing-config", identifier);
  }

  try {
    // The backend (Postgres or Redis, selected inside lib/kv) executes the
    // sliding-window check atomically; both backends reproduce the same
    // weighted-window semantics and the 1s timeout-as-"timeout"-reason shape.
    const result = await kvSlidingWindowLimit({
      prefix: policy.prefix,
      identifier,
      limit: policy.limit,
      windowMs: durationToMilliseconds(policy.window),
    });

    if (result.reason === "timeout") {
      return handleRateLimitUnavailable(policy, "timeout", identifier);
    }

    if (!result.success) {
      return rateLimitExceededResponse(result);
    }

    return null;
  } catch (error) {
    return handleRateLimitUnavailable(policy, "check-error", identifier, error);
  }
}

/**
 * Read-side project rate limit: GET /api/projects and the editor page's
 * shared-project lookup.
 */
export function enforceProjectReadRateLimit(request: RateLimitRequestLike) {
  return enforceRateLimit(request, PROJECTS_READ_RATE_LIMIT);
}

/**
 * Write-side project rate limit: POST /api/projects. Must be enforced before
 * reading or storing the request body so rejected requests cost no storage.
 */
export function enforceProjectWriteRateLimit(request: RateLimitRequestLike) {
  return enforceRateLimit(request, PROJECTS_WRITE_RATE_LIMIT);
}

export function enforceMcpRateLimit(request: RateLimitRequestLike) {
  return enforceRateLimit(request, MCP_RATE_LIMIT);
}

export function enforceMcpRenderPreviewRateLimit(request: RateLimitRequestLike) {
  return enforceRateLimit(request, MCP_RENDER_PREVIEW_RATE_LIMIT);
}

export function enforceMcpRenderVideoRateLimit(request: RateLimitRequestLike) {
  return enforceRateLimit(request, MCP_RENDER_VIDEO_RATE_LIMIT);
}

export function enforceRenderReadRateLimit(request: RateLimitRequestLike) {
  return enforceRateLimit(request, RENDERS_READ_RATE_LIMIT);
}
