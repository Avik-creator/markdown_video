import { describe, expect, it } from "vitest";
import {
  EXPORT_EVENT_NAMES,
  beforeSendAnalyticsEvent,
  buildExportEventProperties,
  countSceneTypes,
  encodeSceneTypeCounts,
  isCancellationError,
  normalizeToken,
  stripUrlQueryAndHash,
  trackExportEvent,
} from "../analytics";

describe("stripUrlQueryAndHash", () => {
  it("strips the query string from a full URL", () => {
    expect(stripUrlQueryAndHash("https://example.com/editor?md=secret")).toBe(
      "https://example.com/editor"
    );
  });

  it("strips both query string and hash fragment", () => {
    expect(stripUrlQueryAndHash("https://example.com/editor?md=secret#frag")).toBe(
      "https://example.com/editor"
    );
    expect(stripUrlQueryAndHash("https://example.com/editor#frag")).toBe(
      "https://example.com/editor"
    );
  });

  it("handles malformed URLs where the hash precedes the question mark", () => {
    expect(stripUrlQueryAndHash("https://example.com/editor#frag?md=secret")).toBe(
      "https://example.com/editor"
    );
  });

  it("strips query strings from path-only URLs", () => {
    expect(stripUrlQueryAndHash("/editor?md=secret")).toBe("/editor");
  });

  it("leaves clean URLs unchanged", () => {
    expect(stripUrlQueryAndHash("https://example.com/editor")).toBe(
      "https://example.com/editor"
    );
    expect(stripUrlQueryAndHash("/")).toBe("/");
  });

  it("strips inline share-link markdown payloads completely", () => {
    const markdown = "# Secret doc\n\nconfidential ? content # here";
    const url = `https://markdownvideo.example.com/editor?md=${encodeURIComponent(markdown)}`;

    const stripped = stripUrlQueryAndHash(url);

    expect(stripped).toBe("https://markdownvideo.example.com/editor");
    expect(stripped).not.toContain("md=");
    expect(stripped).not.toContain("Secret");
  });
});

describe("beforeSendAnalyticsEvent", () => {
  it("strips query and hash from pageview events while preserving the event shape", () => {
    const event = {
      type: "pageview" as const,
      url: "https://example.com/editor?md=secret#frag",
    };

    const result = beforeSendAnalyticsEvent(event);

    expect(result).toEqual({
      type: "pageview",
      url: "https://example.com/editor",
    });
  });

  it("strips query strings from custom events", () => {
    const event = {
      type: "event" as const,
      url: "https://example.com/editor?md=secret",
    };

    expect(beforeSendAnalyticsEvent(event).url).toBe("https://example.com/editor");
  });

  it("never lets a query string survive in any reported URL", () => {
    const nastyMarkdown = "!scene\n!text\nuser secrets and tokens";
    const url = `https://example.com/editor?md=${encodeURIComponent(nastyMarkdown)}&project=abcDEF123-_`;

    const result = beforeSendAnalyticsEvent({ type: "pageview", url });

    expect(result.url).not.toContain("?");
    expect(result.url).not.toContain("#");
    expect(result.url).not.toContain("md");
    expect(result.url).not.toContain("project");
  });
});

describe("EXPORT_EVENT_NAMES", () => {
  it("defines the four export lifecycle events", () => {
    expect(EXPORT_EVENT_NAMES.started).toBe("export_started");
    expect(EXPORT_EVENT_NAMES.finished).toBe("export_finished");
    expect(EXPORT_EVENT_NAMES.failed).toBe("export_failed");
    expect(EXPORT_EVENT_NAMES.cancelled).toBe("export_cancelled");
  });

  it("uses unique lowercase snake_case names", () => {
    const names = Object.values(EXPORT_EVENT_NAMES);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z0-9_]+$/);
    }
  });
});

describe("normalizeToken", () => {
  it("lowercases, trims, and underscore-joins whitespace", () => {
    expect(normalizeToken("  High ")).toBe("high");
    expect(normalizeToken("YouTube Shorts")).toBe("youtube_shorts");
  });

  it("preserves colons and digits used by aspect ratios and resolutions", () => {
    expect(normalizeToken("16:9")).toBe("16:9");
    expect(normalizeToken("1080p")).toBe("1080p");
  });

  it("falls back to 'unknown' for missing or empty values", () => {
    expect(normalizeToken(undefined)).toBe("unknown");
    expect(normalizeToken(null)).toBe("unknown");
    expect(normalizeToken("")).toBe("unknown");
    expect(normalizeToken("   ")).toBe("unknown");
  });
});

describe("countSceneTypes", () => {
  it("counts occurrences of each scene type", () => {
    const counts = countSceneTypes([
      { type: "text" },
      { type: "code" },
      { type: "text" },
      { type: "terminal" },
      { type: "code" },
      { type: "text" },
    ]);

    expect(counts).toEqual({ text: 3, code: 2, terminal: 1 });
  });

  it("normalizes type casing and whitespace", () => {
    const counts = countSceneTypes([{ type: "Text" }, { type: " text " }]);

    expect(counts).toEqual({ text: 2 });
  });

  it("bucket scenes without a usable type as 'unknown'", () => {
    const counts = countSceneTypes([
      { type: undefined },
      { type: "" },
      { type: null },
    ]);

    expect(counts).toEqual({ unknown: 3 });
  });

  it("returns an empty object for empty or missing input", () => {
    expect(countSceneTypes([])).toEqual({});
    expect(countSceneTypes(undefined)).toEqual({});
  });
});

describe("encodeSceneTypeCounts", () => {
  it("encodes counts as sorted type:count pairs", () => {
    expect(encodeSceneTypeCounts({ text: 3, code: 2, terminal: 1 })).toBe(
      "code:2,terminal:1,text:3"
    );
  });

  it("skips non-positive counts", () => {
    expect(encodeSceneTypeCounts({ text: 0, code: -1, chart: 2 })).toBe(
      "chart:2"
    );
  });

  it("encodes empty counts as 'none'", () => {
    expect(encodeSceneTypeCounts({})).toBe("none");
    expect(encodeSceneTypeCounts({ text: 0 })).toBe("none");
  });
});

describe("buildExportEventProperties", () => {
  const input = {
    format: "mp4",
    resolution: "1080p",
    quality: "high",
    speed: "balanced",
    fps: 30,
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    durationSeconds: 12.5,
    totalFrames: 375,
    scenes: [
      { type: "text" },
      { type: "code" },
      { type: "code" },
      { type: "terminal" },
    ],
  };

  it("builds the full payload for a typical export", () => {
    expect(buildExportEventProperties(input)).toEqual({
      format: "mp4",
      settings: "1080p/30fps/high/balanced",
      output: "16:9/1920x1080",
      duration: 12.5,
      frames: 375,
      scene_count: 4,
      scenes: "code:2,terminal:1,text:1",
    });
  });

  it("stays within the Vercel Analytics limit of 8 properties per event", () => {
    const properties = buildExportEventProperties(input);
    expect(Object.keys(properties).length).toBeLessThanOrEqual(8);
  });

  it("only uses flat primitive property values allowed by Vercel Analytics", () => {
    const properties = buildExportEventProperties(input);
    for (const value of Object.values(properties)) {
      expect(["string", "number", "boolean"]).toContain(typeof value);
    }
  });

  it("keeps every value well under the 255 character limit", () => {
    const manyScenes = Array.from({ length: 50 }, (_, index) => ({
      type: index % 2 === 0 ? "code" : "text",
    }));
    const properties = buildExportEventProperties({ ...input, scenes: manyScenes });
    for (const value of Object.values(properties)) {
      expect(String(value).length).toBeLessThanOrEqual(255);
    }
  });

  it("rounds duration to one decimal and frames to an integer", () => {
    const properties = buildExportEventProperties({
      ...input,
      durationSeconds: 12.456,
      totalFrames: 375.5,
    });

    expect(properties.duration).toBe(12.5);
    expect(properties.frames).toBe(376);
  });

  it("clamps non-finite and negative numbers to zero", () => {
    const properties = buildExportEventProperties({
      ...input,
      durationSeconds: Number.NaN,
      totalFrames: -5,
    });

    expect(properties.duration).toBe(0);
    expect(properties.frames).toBe(0);
  });

  it("falls back to 'unknown' tokens when settings are missing", () => {
    const properties = buildExportEventProperties({});

    expect(properties.format).toBe("unknown");
    expect(properties.settings).toBe("unknown/0fps/unknown/unknown");
    expect(properties.output).toBe("unknown/0x0");
    expect(properties.duration).toBe(0);
    expect(properties.frames).toBe(0);
    expect(properties.scene_count).toBe(0);
    expect(properties.scenes).toBe("none");
  });

  it("encodes vertical social formats with their output aspect", () => {
    const properties = buildExportEventProperties({
      ...input,
      format: "reels",
      aspectRatio: "9:16",
      width: 1080,
      height: 1920,
    });

    expect(properties.format).toBe("reels");
    expect(properties.output).toBe("9:16/1080x1920");
  });

  it("never includes user content, markdown, or identifiers in the payload", () => {
    const properties = buildExportEventProperties(input);
    const serialized = JSON.stringify(properties).toLowerCase();

    for (const forbidden of ["markdown", "content", "url", "user", "id"]) {
      expect(serialized).not.toContain(`"${forbidden}":`);
    }
    // Scene payloads only encode type names and counts, never scene text.
    expect(Object.keys(properties)).not.toContain("markdown");
    expect(Object.keys(properties)).not.toContain("id");
  });
});

describe("isCancellationError", () => {
  it("detects the render pipeline's cancellation error by name", () => {
    const error = new Error("Rendering cancelled");
    error.name = "RenderCancelledError";

    expect(isCancellationError(error)).toBe(true);
  });

  it("detects AbortError DOMExceptions", () => {
    expect(
      isCancellationError(new DOMException("Aborted", "AbortError"))
    ).toBe(true);
    expect(isCancellationError({ name: "AbortError" })).toBe(true);
  });

  it("does not classify regular errors as cancellation", () => {
    expect(isCancellationError(new Error("MP4 encoding failed"))).toBe(false);
    expect(isCancellationError({ name: "TypeError" })).toBe(false);
  });

  it("does not classify non-error values as cancellation", () => {
    expect(isCancellationError(null)).toBe(false);
    expect(isCancellationError(undefined)).toBe(false);
    expect(isCancellationError("RenderCancelledError")).toBe(false);
    expect(isCancellationError(42)).toBe(false);
  });
});

describe("trackExportEvent", () => {
  it("is a no-op that does not throw outside the browser", () => {
    // The vitest environment is Node without a window. Calling track() from
    // @vercel/analytics directly would throw here, so this exercises the guard.
    expect(typeof window).toBe("undefined");
    expect(() =>
      trackExportEvent(EXPORT_EVENT_NAMES.started, { format: "mp4" })
    ).not.toThrow();
  });

  it("accepts events without properties", () => {
    expect(() => trackExportEvent(EXPORT_EVENT_NAMES.finished)).not.toThrow();
  });
});
