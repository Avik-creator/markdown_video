import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  enforceMcpRateLimit,
  enforceMcpRenderPreviewRateLimit,
  enforceMcpRenderVideoRateLimit,
  isRenderWorkerConfigured,
  renderWorkerPreview,
  renderWorkerVideo,
  isRenderStorageConfigured,
  storeRenderVideo,
} = vi.hoisted(() => ({
  enforceMcpRateLimit: vi.fn(),
  enforceMcpRenderPreviewRateLimit: vi.fn(),
  enforceMcpRenderVideoRateLimit: vi.fn(),
  isRenderWorkerConfigured: vi.fn(),
  renderWorkerPreview: vi.fn(),
  renderWorkerVideo: vi.fn(),
  isRenderStorageConfigured: vi.fn(),
  storeRenderVideo: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceMcpRateLimit,
  enforceMcpRenderPreviewRateLimit,
  enforceMcpRenderVideoRateLimit,
}));
vi.mock("@/lib/render-worker-client", () => ({
  isRenderWorkerConfigured,
  renderWorkerPreview,
  renderWorkerVideo,
}));
vi.mock("@/lib/render-storage", () => ({
  isRenderStorageConfigured,
  storeRenderVideo,
}));

import { GET, POST } from "../route";

// Talks to the route handler the way an MCP client does over Streamable
// HTTP. Guards against dependency drift: mcp-handler 1.0.4 with SDK 1.25
// dropped every request header, so all requests failed with 406.

let nextId = 1;

const MAX_MCP_REQUEST_BODY_BYTES = 512 * 1024;

function rpcRequest(method: string, params: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/mcp/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
}

function rpcRequestWithBody(body: string | ReadableStream<Uint8Array>) {
  return new Request("http://localhost/api/mcp/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

function streamedBody(text: string, chunkSize = 64 * 1024) {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const next = bytes.slice(offset, offset + chunkSize);
      offset += next.byteLength;
      controller.enqueue(next);
    },
  });
}

function initializeBodyWithPadding(padding: string) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: nextId++,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0" },
      padding,
    },
  });
}

function oversizedInitializeBody() {
  return initializeBodyWithPadding("x".repeat(MAX_MCP_REQUEST_BODY_BYTES));
}

function exactBoundaryInitializeBody() {
  // The two-pass overhead calibration this replaces was sensitive to nextId
  // digit width changing between passes (id 9 vs 10 adds a byte). Iterate to
  // a fixed point instead: adjust the padding by the exact measured delta,
  // which converges immediately because ASCII padding is one byte per char.
  let paddingLength = MAX_MCP_REQUEST_BODY_BYTES;
  for (let attempt = 0; attempt < 4; attempt++) {
    const body = initializeBodyWithPadding("x".repeat(Math.max(0, paddingLength)));
    const delta = MAX_MCP_REQUEST_BODY_BYTES - Buffer.byteLength(body, "utf8");
    if (delta === 0) {
      return body;
    }
    paddingLength += delta;
  }
  throw new Error("exactBoundaryInitializeBody did not converge");
}

async function readRpcPayload(res: Response) {
  const text = await res.text();
  // Responses may come back as plain JSON or as a single SSE event.
  const payload = text.includes("data: ")
    ? text
        .split("\n")
        .find((line) => line.startsWith("data: "))!
        .slice("data: ".length)
    : text;
  return JSON.parse(payload);
}

async function rpc(method: string, params: Record<string, unknown> = {}) {
  const res = await POST(rpcRequest(method, params));
  return { status: res.status, body: await readRpcPayload(res) };
}

async function callTool(name: string, args: Record<string, unknown>) {
  const { body } = await rpc("tools/call", { name, arguments: args });
  return body.result.content[0].text as string;
}

describe("MCP route", () => {
  beforeEach(() => {
    enforceMcpRateLimit.mockReset();
    enforceMcpRenderPreviewRateLimit.mockReset();
    enforceMcpRenderVideoRateLimit.mockReset();
    isRenderWorkerConfigured.mockReset();
    renderWorkerPreview.mockReset();
    renderWorkerVideo.mockReset();
    isRenderStorageConfigured.mockReset();
    storeRenderVideo.mockReset();
    enforceMcpRateLimit.mockResolvedValue(null);
    enforceMcpRenderPreviewRateLimit.mockResolvedValue(null);
    enforceMcpRenderVideoRateLimit.mockResolvedValue(null);
    isRenderWorkerConfigured.mockReturnValue(true);
    isRenderStorageConfigured.mockReturnValue(true);
  });

  it("accepts an initialize request", async () => {
    const { status, body } = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0" },
    });
    expect(status).toBe(200);
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.serverInfo).toEqual({ name: "markdown-video", version: "1.0.0" });
  });

  it("accepts requests at the rewritten /mcp public path", async () => {
    // apps/web/proxy.ts rewrites /mcp to this route while preserving the
    // original URL, so the handler receives requests whose pathname is /mcp.
    const request = new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: nextId++,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0" } },
      }),
    });

    const response = await POST(request);
    const text = await response.text();
    const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
    const body = JSON.parse(dataLine!.slice("data: ".length));

    expect(response.status).toBe(200);
    expect(body.result.serverInfo).toEqual({ name: "markdown-video", version: "1.0.0" });
  });

  it("enforces the 512 KiB body cap at the rewritten /mcp public path", async () => {
    const body = oversizedInitializeBody();
    const request = new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body,
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
  });

  it("lists all twelve tools", async () => {
    const { body } = await rpc("tools/list");
    expect(body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual([
      "generate_template",
      "get_directive_docs",
      "get_examples",
      "get_suggestions",
      "list_directives",
      "parse_markdown",
      "quick_check",
      "quick_reference",
      "render_preview",
      "render_video",
      "search_docs",
      "validate_syntax",
    ]);
  });

  it("advertises maximum lengths for every free-form string input", async () => {
    const { body } = await rpc("tools/list");
    const tool = (name: string) =>
      body.result.tools.find((candidate: { name: string }) => candidate.name === name);

    for (const name of ["validate_syntax", "quick_check", "parse_markdown", "get_suggestions"]) {
      expect(tool(name).inputSchema.properties.markdown.maxLength).toBe(100_000);
    }
    expect(tool("get_directive_docs").inputSchema.properties.directive.maxLength).toBe(100);
    expect(tool("search_docs").inputSchema.properties.query.maxLength).toBe(200);
  });

  it("rejects markdown arguments over the advertised maximum length", async () => {
    const { body } = await rpc("tools/call", {
      name: "validate_syntax",
      arguments: { markdown: "x".repeat(100_001) },
    });

    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("Input validation error");
    expect(body.result.content[0].text).toMatch(/at most 100000 character|<=100000 characters/i);
  });

  it("rejects tool arguments with excessive element counts before schema validation", async () => {
    const extraArguments = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [`extra${index}`, index])
    );

    const { body } = await rpc("tools/call", {
      name: "validate_syntax",
      arguments: {
        markdown: "!scene\n!text\nHello",
        ...extraArguments,
      },
    });

    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("maximum of 100 elements");
  });

  it("rejects declared POST bodies over 512 KiB with a JSON-RPC 413", async () => {
    const body = oversizedInitializeBody();
    expect(Buffer.byteLength(body, "utf8")).toBeGreaterThan(MAX_MCP_REQUEST_BODY_BYTES);

    const response = await POST(rpcRequestWithBody(body));
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(payload).toEqual({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: `Payload Too Large: Request body must not exceed ${MAX_MCP_REQUEST_BODY_BYTES} bytes`,
      },
      id: null,
    });
  });

  it("accepts a POST body exactly at the 512 KiB boundary", async () => {
    const body = exactBoundaryInitializeBody();
    expect(Buffer.byteLength(body, "utf8")).toBe(MAX_MCP_REQUEST_BODY_BYTES);

    const response = await POST(rpcRequestWithBody(body));

    expect(response.status).toBe(200);
  });

  it("enforces the 512 KiB body cap for streamed bodies without a content-length", async () => {
    const request = rpcRequestWithBody(streamedBody(oversizedInitializeBody()));
    expect(request.headers.get("content-length")).toBeNull();

    const response = await POST(request);

    expect(response.status).toBe(413);
  });

  it("preserves valid streamed MCP POST bodies", async () => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: nextId++,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    });

    const response = await POST(rpcRequestWithBody(streamedBody(body, 16)));
    const payload = await readRpcPayload(response);

    expect(response.status).toBe(200);
    expect(payload.result.serverInfo).toEqual({ name: "markdown-video", version: "1.0.0" });
  });

  it("returns the rate-limit response before MCP handling", async () => {
    enforceMcpRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(rpcRequest("tools/list"));

    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("Rate limit exceeded");
  });

  it("disables the legacy SSE endpoint", async () => {
    const response = await GET(
      new Request("http://localhost/api/mcp/sse", {
        headers: { Accept: "text/event-stream" },
      })
    );

    expect(response.status).toBe(404);
  });

  it("validate_syntax reports problems with line numbers, in line order", async () => {
    const text = await callTool("validate_syntax", {
      markdown: "!scene\n!transtion fade\n!text\nHello\nanimation: wobble",
    });
    const line2 = text.indexOf('Line 2: Unknown directive "!transtion". Did you mean "!transition"?');
    const line5 = text.indexOf(
      "Line 5: Scene 1: looks like property `animation` but `wobble` is not valid; treating as text"
    );
    expect(line2).toBeGreaterThan(-1);
    expect(line5).toBeGreaterThan(line2);
  });

  it("validate_syntax accepts a valid document", async () => {
    const text = await callTool("validate_syntax", { markdown: "!scene\n!text\nHello" });
    expect(text).toContain("Valid: true");
  });

  it("render_preview returns MCP image content blocks from worker PNGs", async () => {
    renderWorkerPreview.mockResolvedValueOnce({
      duration: 2,
      width: 1280,
      height: 720,
      frames: [0, 1, 2].map((time) => ({
        time,
        pngBase64: Buffer.from(`png-${time}`).toString("base64"),
      })),
    });

    const { body } = await rpc("tools/call", {
      name: "render_preview",
      arguments: { markdown: "!scene\n!duration 2\n!text\nHello", times: [0, 1, 2] },
    });

    expect(body.result.isError).not.toBe(true);
    expect(body.result.content[0].text).toContain("Rendered 3 preview frame");
    expect(body.result.content.slice(1)).toEqual(
      [0, 1, 2].map((time) => ({
        type: "image",
        data: Buffer.from(`png-${time}`).toString("base64"),
        mimeType: "image/png",
      }))
    );
    expect(enforceMcpRenderPreviewRateLimit).toHaveBeenCalled();
  });

  it("render_video stores the worker mp4 and returns its temporary URL metadata", async () => {
    renderWorkerVideo.mockResolvedValueOnce({
      mp4: Buffer.from("mp4"),
      duration: 1,
      width: 854,
      height: 480,
      fps: 12,
      totalFrames: 12,
      sizeBytes: 3,
    });
    storeRenderVideo.mockResolvedValueOnce({
      id: "a".repeat(32),
      duration: 1,
      width: 854,
      height: 480,
      fps: 12,
      totalFrames: 12,
      sizeBytes: 3,
      expiresAt: "2030-01-01T00:00:00.000Z",
      ttlSeconds: 3600,
    });

    const { body } = await rpc("tools/call", {
      name: "render_video",
      arguments: {
        markdown: "!scene\n!duration 1\n!text\nHello",
        options: { resolution: "480p", fps: 12 },
      },
    });

    expect(body.result.isError).not.toBe(true);
    expect(body.result.structuredContent).toMatchObject({
      id: "a".repeat(32),
      duration: 1,
      width: 854,
      height: 480,
      sizeBytes: 3,
    });
    expect(body.result.structuredContent.url).toContain(`/api/renders/${"a".repeat(32)}`);
    expect(storeRenderVideo).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 1, width: 854, fps: 12 })
    );
    expect(enforceMcpRenderVideoRateLimit).toHaveBeenCalled();
  });

  it("render tools fail closed with clear tool errors when unconfigured", async () => {
    isRenderWorkerConfigured.mockReturnValue(false);
    const { body } = await rpc("tools/call", {
      name: "render_preview",
      arguments: { markdown: "!scene\n!duration 1\n!text\nHello" },
    });

    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("RENDER_WORKER_URL");
    expect(renderWorkerPreview).not.toHaveBeenCalled();
  });

  it("render tools map fail-closed rate limiting to tool errors", async () => {
    enforceMcpRenderVideoRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Rate limiting is unavailable" }), { status: 503 })
    );
    const { body } = await rpc("tools/call", {
      name: "render_video",
      arguments: { markdown: "!scene\n!duration 1\n!text\nHello" },
    });

    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("fails closed");
    expect(renderWorkerVideo).not.toHaveBeenCalled();
  });
});
