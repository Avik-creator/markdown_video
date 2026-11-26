export interface RenderWorkerConfig {
  host: string
  port: number
  sharedSecret: string
  concurrency: number
  queueLimit: number
}

export class WorkerConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WorkerConfigurationError"
  }
}

function parseBoundedInteger({
  name,
  rawValue,
  fallback,
  minimum,
  maximum,
}: {
  name: string
  rawValue: string | undefined
  fallback: number
  minimum: number
  maximum: number
}) {
  if (rawValue === undefined || rawValue.trim() === "") {
    return fallback
  }
  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new WorkerConfigurationError(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    )
  }
  return value
}

/**
 * Read and validate the worker environment. Missing or weak authentication is
 * a startup error rather than a request-time bypass: a worker that cannot
 * authenticate callers must never come up in an open state.
 */
export function loadWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): RenderWorkerConfig {
  const sharedSecret = env.RENDER_WORKER_SHARED_SECRET
  if (!sharedSecret) {
    throw new WorkerConfigurationError(
      "RENDER_WORKER_SHARED_SECRET is required; refusing to start without authentication.",
    )
  }
  if (sharedSecret.length < 32) {
    throw new WorkerConfigurationError(
      "RENDER_WORKER_SHARED_SECRET must be at least 32 characters.",
    )
  }

  return {
    host: env.HOST ?? "0.0.0.0",
    port: parseBoundedInteger({
      name: "PORT",
      rawValue: env.PORT,
      fallback: 8080,
      minimum: 1,
      maximum: 65_535,
    }),
    sharedSecret,
    concurrency: parseBoundedInteger({
      name: "RENDER_WORKER_CONCURRENCY",
      rawValue: env.RENDER_WORKER_CONCURRENCY,
      fallback: 1,
      minimum: 1,
      maximum: 4,
    }),
    queueLimit: parseBoundedInteger({
      name: "RENDER_WORKER_QUEUE_LIMIT",
      rawValue: env.RENDER_WORKER_QUEUE_LIMIT,
      fallback: 8,
      minimum: 0,
      maximum: 64,
    }),
  }
}
