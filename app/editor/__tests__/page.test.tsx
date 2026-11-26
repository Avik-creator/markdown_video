import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  enforceProjectReadRateLimit,
  getRequestHeaders,
  redisGet,
  shareLinkErrorComponent,
  shareProjectGateComponent,
  videoEditorComponent,
} = vi.hoisted(() => ({
  enforceProjectReadRateLimit: vi.fn(),
  getRequestHeaders: vi.fn(),
  redisGet: vi.fn(),
  shareLinkErrorComponent: () => null,
  shareProjectGateComponent: () => null,
  videoEditorComponent: () => null,
}));

vi.mock("next/headers", () => ({
  headers: getRequestHeaders,
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceProjectReadRateLimit,
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: redisGet,
  },
}));

vi.mock("@components/video-editor/video-editor", () => ({
  VideoEditor: videoEditorComponent,
}));

vi.mock("@components/video-editor/share-link-error", () => ({
  ShareLinkError: shareLinkErrorComponent,
}));

vi.mock("@components/video-editor/share-project-gate", () => ({
  ShareProjectGate: shareProjectGateComponent,
}));

import EditorPage from "../page";

type EditorSearchParams = {
  md?: string | string[];
  project?: string | string[];
  embed?: string | string[];
};

function renderEditor(params: EditorSearchParams) {
  return EditorPage({ searchParams: Promise.resolve(params) });
}

describe("editor page share-project resolution", () => {
  beforeEach(() => {
    enforceProjectReadRateLimit.mockReset();
    getRequestHeaders.mockReset();
    redisGet.mockReset();

    getRequestHeaders.mockResolvedValue(
      new Headers({ "x-forwarded-for": "198.51.100.77" })
    );
    enforceProjectReadRateLimit.mockResolvedValue(null);
  });

  it("does not rate-limit or touch project storage for ordinary editor usage", async () => {
    const element = await renderEditor({});

    expect(element.type).toBe(videoEditorComponent);
    expect(element.props).toEqual({ isEmbed: false });
    expect(getRequestHeaders).not.toHaveBeenCalled();
    expect(enforceProjectReadRateLimit).not.toHaveBeenCalled();
    expect(redisGet).not.toHaveBeenCalled();
  });

  it("applies the project rate limit with request headers before reading a valid project share", async () => {
    redisGet.mockResolvedValue("!scene\n!text\nStored project");

    const element = await renderEditor({ project: "abcDEF123-_" });

    expect(getRequestHeaders).toHaveBeenCalledTimes(1);
    expect(enforceProjectReadRateLimit).toHaveBeenCalledTimes(1);
    const [rateLimitSource] = enforceProjectReadRateLimit.mock.calls[0];
    expect(rateLimitSource.headers.get("x-forwarded-for")).toBe("198.51.100.77");
    expect(redisGet).toHaveBeenCalledWith("project:abcDEF123-_");
    expect(element.type).toBe(shareProjectGateComponent);
    expect(element.props).toEqual({
      initialMarkdown: "!scene\n!text\nStored project",
      isEmbed: false,
    });
  });

  it("resolves projects stored in the versioned wrapper shape", async () => {
    redisGet.mockResolvedValue({ v: 1, markdown: "42" });

    const element = await renderEditor({ project: "abcDEF123-_" });

    expect(element.type).toBe(shareProjectGateComponent);
    expect(element.props).toEqual({
      initialMarkdown: "42",
      isEmbed: false,
    });
  });

  it("recovers legacy scalar-corrupted projects", async () => {
    // Simulates the Upstash client auto-deserializing a legacy plain-string
    // write whose entire markdown was `42` into the number 42.
    redisGet.mockResolvedValue(42);

    const element = await renderEditor({ project: "abcDEF123-_" });

    expect(element.type).toBe(shareProjectGateComponent);
    expect(element.props).toEqual({
      initialMarkdown: "42",
      isEmbed: false,
    });
  });

  it("treats unparseable stored values as project-not-found", async () => {
    redisGet.mockResolvedValue([1, 2, 3]);

    const element = await renderEditor({ project: "abcDEF123-_" });

    expect(element.type).toBe(shareLinkErrorComponent);
    expect(element.props).toEqual({ kind: "project-not-found", isEmbed: false });
  });

  it("does not spend project-lookup rate limit on malformed project IDs", async () => {
    const element = await renderEditor({ project: "invalid" });

    expect(element.type).toBe(shareLinkErrorComponent);
    expect(element.props).toEqual({ kind: "project-not-found", isEmbed: false });
    expect(getRequestHeaders).not.toHaveBeenCalled();
    expect(enforceProjectReadRateLimit).not.toHaveBeenCalled();
    expect(redisGet).not.toHaveBeenCalled();
  });

  it("does not swallow headers/rendering control-flow exceptions", async () => {
    const renderingControlError = new Error("rendering control flow");
    getRequestHeaders.mockRejectedValueOnce(renderingControlError);

    await expect(renderEditor({ project: "abcDEF123-_" })).rejects.toBe(renderingControlError);
    expect(enforceProjectReadRateLimit).not.toHaveBeenCalled();
    expect(redisGet).not.toHaveBeenCalled();
  });

  it("shows temporary unavailability and skips Redis when the project lookup is rate limited", async () => {
    enforceProjectReadRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    );

    const element = await renderEditor({ project: "abcDEF123-_" });

    expect(element.type).toBe(shareLinkErrorComponent);
    expect(element.props).toEqual({ kind: "project-unavailable", isEmbed: false });
    expect(redisGet).not.toHaveBeenCalled();
  });
});
