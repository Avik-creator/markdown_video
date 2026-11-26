import { createServer } from "node:http"
import { createRequire } from "node:module"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import path from "node:path"

import { RenderError } from "./errors.js"

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
}

export interface RenderPageServer {
  url: string
  rootDir: string
  close(): Promise<void>
}

export function resolveRenderPageDist() {
  const require = createRequire(import.meta.url)
  let packageJsonPath: string
  try {
    packageJsonPath = require.resolve("@markdown-video/render-page/package.json")
  } catch (error) {
    throw new RenderError(
      "Could not resolve @markdown-video/render-page. Run pnpm install first.",
      { cause: error instanceof Error ? error : undefined },
    )
  }

  const rootDir = path.join(path.dirname(packageJsonPath), "dist")
  return stat(rootDir)
    .then((stats) => {
      if (!stats.isDirectory()) throw new Error("not a directory")
      return rootDir
    })
    .catch(() => {
      throw new RenderError(
        `Render-page build is missing at ${rootDir}. Run: pnpm --filter @markdown-video/render-page build`,
      )
    })
}

function sendFile(
  rootDir: string,
  pathname: string,
  response: import("node:http").ServerResponse,
) {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    response.writeHead(400).end("Bad request")
    return
  }

  const withoutLeadingSlash = decoded.replace(/^\/+/, "")
  const resolved = path.resolve(rootDir, withoutLeadingSlash)
  const relative = path.relative(rootDir, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    response.writeHead(403).end("Forbidden")
    return
  }

  void stat(resolved)
    .then((stats) => {
      const filePath = stats.isDirectory()
        ? path.join(resolved, "index.html")
        : resolved
      return stat(filePath).then((fileStats) => ({ filePath, fileStats }))
    })
    .then(({ filePath, fileStats }) => {
      if (!fileStats.isFile()) throw new Error("not a file")
      response.writeHead(200, {
        "content-type": MIME_TYPES[path.extname(filePath).toLowerCase()] ??
          "application/octet-stream",
        "content-length": fileStats.size,
        "cache-control": "no-store",
      })
      createReadStream(filePath).pipe(response)
    })
    .catch(() => {
      response.writeHead(404).end("Not found")
    })

}

/**
 * Serve only the immutable production assets from disk on an ephemeral
 * loopback port. This avoids filesystem URL/CORS differences while making the
 * origin deterministic and unreachable from other machines.
 */
export async function serveRenderPage(): Promise<RenderPageServer> {
  const rootDir = await resolveRenderPageDist()
  const server = createServer((request, response) => {
    const host = request.headers.host ?? "127.0.0.1"
    let url: URL
    try {
      url = new URL(request.url ?? "/", `http://${host}`)
    } catch {
      response.writeHead(400).end("Bad request")
      return
    }
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname
    sendFile(rootDir, pathname, response)
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === "string") {
    server.close()
    throw new RenderError("Failed to bind the render-page server.")
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    rootDir,
    async close() {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      })
    },
  }
}
