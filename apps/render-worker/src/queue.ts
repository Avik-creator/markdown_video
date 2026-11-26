export class RenderQueueFullError extends Error {
  constructor() {
    super("Render worker queue is full")
    this.name = "RenderQueueFullError"
  }
}

function abortedError() {
  const error = new Error("Render request was cancelled or timed out")
  error.name = "AbortError"
  return error
}

interface QueuedTask<T> {
  operation: (signal: AbortSignal) => Promise<T>
  signal: AbortSignal
  resolve: (value: T) => void
  reject: (error: unknown) => void
  onAbort: () => void
}

/**
 * Small bounded in-process queue. Chromium renders are deliberately serialized
 * by default because one browser can easily consume hundreds of MB; unbounded
 * HTTP parallelism would turn a traffic burst into memory exhaustion.
 */
export class RenderQueue {
  private active = 0
  private readonly queued: Array<QueuedTask<unknown>> = []

  constructor(
    private readonly concurrency: number,
    private readonly queueLimit: number,
  ) {}

  get waitingCount() {
    return this.queued.length
  }

  get activeCount() {
    return this.active
  }

  run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    signal: AbortSignal,
  ): Promise<T> {
    if (signal.aborted) {
      return Promise.reject(abortedError())
    }
    if (this.active >= this.concurrency && this.queued.length >= this.queueLimit) {
      return Promise.reject(new RenderQueueFullError())
    }

    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask<T> = {
        operation,
        signal,
        resolve,
        reject,
        onAbort: () => undefined,
      }
      task.onAbort = () => {
        const index = this.queued.indexOf(task as QueuedTask<unknown>)
        if (index >= 0) {
          this.queued.splice(index, 1)
          signal.removeEventListener("abort", task.onAbort)
          reject(abortedError())
        }
      }

      this.queued.push(task as QueuedTask<unknown>)
      signal.addEventListener("abort", task.onAbort, { once: true })
      this.pump()
    })
  }

  private pump() {
    while (this.active < this.concurrency && this.queued.length > 0) {
      const task = this.queued.shift()!
      task.signal.removeEventListener("abort", task.onAbort)
      this.active += 1

      void task
        .operation(task.signal)
        .then(task.resolve, task.reject)
        .finally(() => {
          this.active -= 1
          this.pump()
        })
    }
  }
}
