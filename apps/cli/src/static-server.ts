import { createServer } from "node:http"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

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

function renderPageCandidates() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  return [
    // Published packages carry the complete Vite payload beside the bundled
    // JavaScript, so rendering does not depend on private workspace packages.
    path.join(moduleDir, "render-page"),
    // Source checkout fallback used by unit/integration tests before the CLI's
    // own dist directory has been assembled. Both src/ and dist/ are one level
    // below apps/cli, so this resolves to apps/render/dist in either case.
    path.resolve(moduleDir, "../../render/dist"),
  ]
}

export async function resolveRenderPageDist() {
  const candidates = renderPageCandidates()
  for (const rootDir of candidates) {
    const stats = await stat(rootDir).catch(() => null)
    if (stats?.isDirectory()) return rootDir
  }

  throw new RenderError(
    "Render-page assets are missing. Reinstall markdown-video; when developing in the monorepo, run: pnpm --filter markdown-video... build",
  )
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
