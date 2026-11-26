export class UsageError extends Error {
  readonly exitCode = 2

  constructor(message: string) {
    super(message)
    this.name = "UsageError"
  }
}

export class RenderError extends Error {
  readonly exitCode = 1

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "RenderError"
  }
}

export class RenderCancelledError extends RenderError {
  constructor() {
    super("Render cancelled.")
    this.name = "RenderCancelledError"
  }
}

export function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new RenderCancelledError()
  }
}
