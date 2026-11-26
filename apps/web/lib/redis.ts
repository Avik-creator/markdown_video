import { Redis } from "@upstash/redis";

export const REDIS_CONFIGURATION_MESSAGE =
  "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN).";

type RedisEnvironmentConfig = {
  url: string;
  token: string;
};

function readRedisEnvironmentConfig(): RedisEnvironmentConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export class RedisConfigurationError extends Error {
  constructor() {
    super(REDIS_CONFIGURATION_MESSAGE);
    this.name = "RedisConfigurationError";
  }
}

export function isRedisConfigured(): boolean {
  return readRedisEnvironmentConfig() !== null;
}

let cachedClient: Redis | undefined;
let cachedClientConfigKey: string | undefined;

export function getRedis(): Redis {
  const config = readRedisEnvironmentConfig();
  if (!config) {
    throw new RedisConfigurationError();
  }

  const configKey = `${config.url}\u0000${config.token}`;
  if (!cachedClient || cachedClientConfigKey !== configKey) {
    cachedClient = new Redis(config);
    cachedClientConfigKey = configKey;
  }

  return cachedClient;
}

/**
 * Compatibility export for existing server code that expects a Redis client.
 * Construction is lazy so importing this module never emits Upstash's missing-env
 * warnings. If Redis is not configured, invoking any client method raises the
 * explicit RedisConfigurationError above instead of a generic network failure.
 */
export const redis: Redis = new Proxy({} as Redis, {
  get(_target, property) {
    // Prevent accidental treatment of the proxy as a thenable.
    if (property === "then") {
      return undefined;
    }

    if (!isRedisConfigured()) {
      return () => {
        throw new RedisConfigurationError();
      };
    }

    const client = getRedis();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
