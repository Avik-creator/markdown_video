import path from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(appRoot, "../..")

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: workspaceRoot,
  outputFileTracingIncludes: {
    // The MCP route invokes the sandbox renderer, whose self-contained CLI
    // payload is generated into lib/render-sandbox/cli-bundle during prebuild.
    "/api/mcp/*": ["./lib/render-sandbox/cli-bundle/**/*"],
  },
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
