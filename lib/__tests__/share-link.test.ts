import { describe, expect, it } from "vitest";
import {
  buildInlineShareLink,
  canUseInlineShareLink,
  decodeShareMarkdownPayload,
  encodeShareMarkdown,
  getInlineShareLinkLength,
  getUtf8ByteLength,
  isShareDocumentTooLarge,
  MAX_SHARE_MARKDOWN_BYTES,
  MAX_SHARE_URL_LENGTH,
} from "../share-link";

const unicodeMarkdown = [
  "!scene",
  "!text",
  "Unicode ✨ café  — emoji 👩🏽‍💻",
  "Reserved characters + / = & ? # %",
  "Blank lines and CRLF follow:",
  "",
  "done\r\nafter-crlf",
].join("\n");

function legacyEncode(markdown: string): string {
  return Buffer.from(encodeURIComponent(markdown), "utf8").toString("base64");
}

function corruptFinalPayloadCharacter(payload: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const finalCharacter = payload.at(-1) ?? "";
  const replacement = alphabet[(alphabet.indexOf(finalCharacter) + 1) % alphabet.length];
  return payload.slice(0, -1) + replacement;
}

describe("share-link encoding", () => {
  it("round-trips Unicode markdown and reserved URL characters", () => {
    const payload = encodeShareMarkdown(unicodeMarkdown);
    const decoded = decodeShareMarkdownPayload(payload);

    expect(decoded).toMatchObject({ ok: true, markdown: unicodeMarkdown });
  });

  it("uses a URL-safe versioned base64url payload without +, /, or padding =", () => {
    const payload = encodeShareMarkdown(unicodeMarkdown);

    expect(payload).toMatch(/^v1\.[0-9a-f]{8}\.[A-Za-z0-9_-]+$/);
    expect(payload).not.toContain("+");
    expect(payload).not.toContain("/");
    expect(payload).not.toContain("=");

    const link = buildInlineShareLink(unicodeMarkdown, "https://example.com");
    const queryPayload = new URL(link).searchParams.get("md");
    expect(queryPayload).toBe(payload);
  });

  it("predicts inline link lengths exactly so large documents skip unnecessary encoding", () => {
    for (const length of [1, 10, 100, 500, 1400]) {
      const markdown = `${"x".repeat(length - 1)}é`;
      const link = buildInlineShareLink(markdown, "https://example.com");

      expect(getInlineShareLinkLength(markdown, "https://example.com")).toBe(link.length);
      expect(canUseInlineShareLink(markdown, "https://example.com")).toBe(link.length <= MAX_SHARE_URL_LENGTH);
    }
  });

  it("does not truncate documents whose encoded payload is longer than 500 characters", () => {
    const longMarkdown = `${unicodeMarkdown}\n${"A long line of markdown that must survive sharing. ".repeat(30)}`;
    const payload = encodeShareMarkdown(longMarkdown);

    expect(payload.length).toBeGreaterThan(500);
    expect(decodeShareMarkdownPayload(payload)).toMatchObject({ ok: true, markdown: longMarkdown });
  });

  it("round-trips across base64 boundary lengths and mixed Unicode code points", () => {
    const codePoints = [0x41, 0xe9, 0x2728, 0x1f469, 0x3053, 0x20ac];

    for (let length = 1; length <= 96; length += 1) {
      const markdown = Array.from({ length }, (_, index) => String.fromCodePoint(codePoints[index % codePoints.length])).join("");
      expect(decodeShareMarkdownPayload(encodeShareMarkdown(markdown))).toMatchObject({ ok: true, markdown });
    }
  });

  it("detects a truncated payload instead of decoding a partial document", () => {
    const longMarkdown = `${unicodeMarkdown}\n${"truncation coverage ".repeat(80)}`;
    const payload = encodeShareMarkdown(longMarkdown);
    const truncated = payload.slice(0, 500);

    expect(payload.length).toBeGreaterThan(500);
    expect(decodeShareMarkdownPayload(truncated).ok).toBe(false);
  });

  it("detects corruption in a syntactically valid payload", () => {
    const payload = encodeShareMarkdown(unicodeMarkdown);
    const corrupted = corruptFinalPayloadCharacter(payload);

    expect(corrupted).not.toBe(payload);
    expect(decodeShareMarkdownPayload(corrupted)).toMatchObject({ ok: false, error: "checksum-mismatch" });
  });

  it("refuses to create an empty payload that the editor could not load", () => {
    expect(() => encodeShareMarkdown("")).toThrow("empty markdown");
  });

  it("reports invalid and malformed payloads", () => {
    expect(decodeShareMarkdownPayload("")).toMatchObject({ ok: false, error: "empty" });
    expect(decodeShareMarkdownPayload("v2.00000000.abc")).toMatchObject({ ok: false, error: "unsupported-version" });
    expect(decodeShareMarkdownPayload("v1.00000000.")).toMatchObject({ ok: false, error: "empty" });
    expect(decodeShareMarkdownPayload("v1.00000000.***")).toMatchObject({ ok: false, error: "invalid-characters" });
    expect(decodeShareMarkdownPayload("v1.00000000.A")).toMatchObject({ ok: false, error: "invalid-length" });
  });

  it("rejects payload bytes that are not valid UTF-8", () => {
    // Base64url `_w` is the single byte 0xff; ff000000 is its CRC32.
    expect(decodeShareMarkdownPayload("v1.ff000000._w")).toMatchObject({ ok: false, error: "invalid-utf8" });
  });

  it("measures UTF-8 bytes and identifies documents above the share storage cap", () => {
    expect(getUtf8ByteLength("✨")).toBe(3);
    expect(getUtf8ByteLength("👩")).toBe(4);
    expect(isShareDocumentTooLarge("x".repeat(MAX_SHARE_MARKDOWN_BYTES))).toBe(false);
    expect(isShareDocumentTooLarge("x".repeat(MAX_SHARE_MARKDOWN_BYTES + 1))).toBe(true);
  });
});

describe("legacy share-link compatibility", () => {
  it("decodes the old base64 encodeURIComponent format, including Unicode", () => {
    const legacyPayload = legacyEncode(unicodeMarkdown);

    expect(decodeShareMarkdownPayload(legacyPayload)).toMatchObject({
      ok: true,
      markdown: unicodeMarkdown,
      format: "legacy-base64",
    });
  });

  it("recovers legacy links whose + characters were decoded as spaces by the query parser", () => {
    const markdown = "d!~8<XLSLi!>";
    const legacyPayload = legacyEncode(markdown);

    expect(legacyPayload).toContain("+");
    const asSeenByNextJs = new URLSearchParams(`md=${legacyPayload}`).get("md") ?? "";
    expect(asSeenByNextJs).toContain(" ");

    expect(decodeShareMarkdownPayload(asSeenByNextJs)).toMatchObject({ ok: true, markdown });
  });

  it("accepts legacy base64 padding", () => {
    const markdown = "hello world";
    const legacyPayload = legacyEncode(markdown);

    expect(legacyPayload.endsWith("==")).toBe(true);
    expect(decodeShareMarkdownPayload(legacyPayload)).toMatchObject({ ok: true, markdown });
  });

  it("rejects malformed legacy percent-encoding", () => {
    const malformedLegacyPayload = Buffer.from("100%", "utf8").toString("base64");

    expect(decodeShareMarkdownPayload(malformedLegacyPayload)).toMatchObject({
      ok: false,
      error: "malformed-legacy",
    });
  });

  it("fails closed for 500-character legacy payloads produced by the old truncating generator", () => {
    const longAsciiMarkdown = "a".repeat(600);
    const truncatedLegacyPayload = legacyEncode(longAsciiMarkdown).slice(0, 500);

    expect(truncatedLegacyPayload).toHaveLength(500);
    expect(decodeShareMarkdownPayload(truncatedLegacyPayload)).toMatchObject({
      ok: false,
      error: "malformed-legacy",
    });
  });
});
