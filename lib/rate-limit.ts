import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { getRedis, isRedisConfigured } from "@/lib/redis";

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
 * Project creation/loading depends on the same Redis instance as rate limiting,
 * so there is no useful degraded mode when Redis cannot be reached: fail closed.
 */
export const PROJECTS_RATE_LIMIT: RateLimitPolicy = {
  prefix: "markdown-video:projects",
  limit: 30,
  window: "1 m",
  failureMode: "fail-closed",
};

/**
 * MCP tools are read-only documentation/validation/parser operations and do not
 * otherwise require Redis. The documented behavior for this policy is therefore
 * a fail-open availability posture: if the optional rate-limit Redis dependency
 * is missing, times out, or errors, requests remain available, but each warm
 * process applies a bounded in-memory fixed-window fallback at the same per-IP
 * limit instead of becoming completely unthrottled.
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

const RATE_LIMIT_TIMEOUT_MS = 1_000;
const RETRY_AFTER_UNAVAILABLE_SECONDS = "30";
const MAX_IP_HEADER_LENGTH = 128;

type MemoryFallbackEntry = {
  count: number;
  reset: number;
};

const limiters = new Map<
  string,
  { redisClient: ReturnType<typeof getRedis>; limiter: Ratelimit }
>();
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

/**
 * Extracts the client IP using the standard proxy headers. The first
 * x-forwarded-for entry is the original client when the deployment platform or
 * reverse proxy appends trusted proxy addresses. If this app is exposed without
 * such a proxy, those headers should be stripped/set by whatever edge layer is
 * in front of it, as clients can otherwise spoof them.
 */
export function getClientIp(request: RateLimitRequestLike): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    for (const candidate of forwardedFor.split(",")) {
      const ip = normalizeIpCandidate(candidate);
      if (ip) {
        return ip;
      }
    }
  }

  return normalizeIpCandidate(request.headers.get("x-real-ip")) ?? "unknown";
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

function getLimiter(policy: RateLimitPolicy): Ratelimit {
  const redisClient = getRedis();
  const cached = limiters.get(policy.prefix);
  if (cached?.redisClient === redisClient) {
    return cached.limiter;
  }

  const limiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
    prefix: policy.prefix,
    timeout: RATE_LIMIT_TIMEOUT_MS,
  });
  limiters.set(policy.prefix, { redisClient, limiter });
  return limiter;
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

  if (!isRedisConfigured()) {
    return handleRateLimitUnavailable(policy, "missing-config", identifier);
  }

  let limiter: Ratelimit;
  try {
    limiter = getLimiter(policy);
  } catch (error) {
    return handleRateLimitUnavailable(policy, "setup-error", identifier, error);
  }

  try {
    const result = await limiter.limit(identifier);

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

export function enforceProjectRateLimit(request: RateLimitRequestLike) {
  return enforceRateLimit(request, PROJECTS_RATE_LIMIT);
}

export function enforceMcpRateLimit(request: RateLimitRequestLike) {
  return enforceRateLimit(request, MCP_RATE_LIMIT);
}
