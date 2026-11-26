import { loadWorkerConfig, WorkerConfigurationError } from "./config.js"
import { createRenderWorkerServer } from "./server.js"

function start() {
  try {
    const config = loadWorkerConfig()
    const server = createRenderWorkerServer(config)

    server.listen(config.port, config.host, () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : config.port
      console.info(
        `[render-worker] listening on ${config.host}:${port} ` +
          `(concurrency=${config.concurrency}, queueLimit=${config.queueLimit})`,
      )
    })

    const shutdown = (signal: NodeJS.Signals) => {
      console.info(`[render-worker] received ${signal}; shutting down`)
      server.close((error) => {
        if (error) {
          console.error("[render-worker] shutdown error", error)
          process.exitCode = 1
        }
      })
      server.closeIdleConnections()
    }
    process.once("SIGTERM", () => shutdown("SIGTERM"))
    process.once("SIGINT", () => shutdown("SIGINT"))
  } catch (error) {
    if (error instanceof WorkerConfigurationError) {
      console.error(`[render-worker] configuration error: ${error.message}`)
    } else {
      console.error("[render-worker] failed to start", error)
    }
    process.exit(1)
  }
}

start()
