import { describe, expect, it } from "vitest";
import { POST } from "../route";

// Talks to the route handler the way an MCP client does over Streamable
// HTTP. Guards against dependency drift: mcp-handler 1.0.4 with SDK 1.25
// dropped every request header, so all requests failed with 406.

let nextId = 1;

async function rpc(method: string, params: Record<string, unknown> = {}) {
  const res = await POST(
    new Request("http://localhost/api/mcp/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    })
  );
  const text = await res.text();
  // Responses may come back as plain JSON or as a single SSE event.
  const payload = text.includes("data: ")
    ? text
        .split("\n")
        .find((line) => line.startsWith("data: "))!
        .slice("data: ".length)
    : text;
  return { status: res.status, body: JSON.parse(payload) };
}

async function callTool(name: string, args: Record<string, unknown>) {
  const { body } = await rpc("tools/call", { name, arguments: args });
  return body.result.content[0].text as string;
}

describe("MCP route", () => {
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

  it("lists all ten tools", async () => {
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
      "search_docs",
      "validate_syntax",
    ]);
  });

  it("validate_syntax reports problems with line numbers, in line order", async () => {
    const text = await callTool("validate_syntax", {
      markdown: "!scene\n!transtion fade\n!text\nHello\nanimation: wobble",
    });
    const line2 = text.indexOf('Line 2: Unknown directive "!transtion". Did you mean "!transition"?');
    const line5 = text.indexOf('Line 5: Scene 1: Invalid animation "wobble"');
    expect(line2).toBeGreaterThan(-1);
    expect(line5).toBeGreaterThan(line2);
  });

  it("validate_syntax accepts a valid document", async () => {
    const text = await callTool("validate_syntax", { markdown: "!scene\n!text\nHello" });
    expect(text).toContain("Valid: true");
  });
});
