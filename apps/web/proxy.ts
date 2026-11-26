import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Clean public URL for the streamable-HTTP MCP endpoint. The canonical route
// is /api/mcp/mcp (the second segment is the transport type in mcp-handler's
// convention), which reads poorly in documentation and client configs, so
// clients connect to /mcp instead. Rewriting (not redirecting) keeps POST
// bodies, MCP session headers, and batching semantics intact.
export function proxy(request: NextRequest) {
  return NextResponse.rewrite(new URL("/api/mcp/mcp", request.url))
}

export const config = {
  matcher: "/mcp",
}
