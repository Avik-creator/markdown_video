import { describe, expect, it } from "vitest";
import {
  PROJECT_STORAGE_VERSION,
  parseProjectMarkdown,
  serializeProjectMarkdown,
} from "../project-storage";

describe("serializeProjectMarkdown", () => {
  it("wraps markdown in the versioned storage object", () => {
    expect(serializeProjectMarkdown("# Hello")).toEqual({
      v: PROJECT_STORAGE_VERSION,
      markdown: "# Hello",
    });
    expect(PROJECT_STORAGE_VERSION).toBe(1);
  });

  it("round-trips type-safely through JSON serialization for JSON-looking markdown", () => {
    // Simulates the Upstash client's write serialization (JSON.stringify) and
    // read deserialization (JSON.parse): numeric-looking, boolean-looking,
    // and ordinary markdown must all survive unchanged.
    for (const markdown of [
      "42",
      "true",
      "false",
      "3.14",
      "-7",
      "[1,2,3]",
      '{"a":1}',
      "null",
      "0",
      "# Ordinary markdown\n\nwith text",
      "42\n\nis the answer but this is a longer document",
    ]) {
      const stored = serializeProjectMarkdown(markdown);
      const wireFormat = JSON.stringify(stored);
      const readBack: unknown = JSON.parse(wireFormat);

      expect(parseProjectMarkdown(readBack)).toBe(markdown);
    }
  });
});

describe("parseProjectMarkdown", () => {
  it("reads the versioned wrapper shape", () => {
    expect(parseProjectMarkdown({ v: 1, markdown: "# Doc" })).toBe("# Doc");
  });

  it("passes legacy plain strings through unchanged", () => {
    expect(parseProjectMarkdown("!scene\n!text\nLegacy")).toBe(
      "!scene\n!text\nLegacy"
    );
  });

  it("recovers legacy number corruption with String conversion", () => {
    expect(parseProjectMarkdown(42)).toBe("42");
    expect(parseProjectMarkdown(3.14)).toBe("3.14");
    expect(parseProjectMarkdown(0)).toBe("0");
    expect(parseProjectMarkdown(-7)).toBe("-7");
  });

  it("recovers legacy boolean corruption with String conversion", () => {
    expect(parseProjectMarkdown(true)).toBe("true");
    expect(parseProjectMarkdown(false)).toBe("false");
  });

  it("returns null for missing values", () => {
    expect(parseProjectMarkdown(null)).toBeNull();
    expect(parseProjectMarkdown(undefined)).toBeNull();
  });

  it("returns null for empty strings and empty wrapped markdown", () => {
    // Empty markdown cannot exist through the write API (min length 1), and
    // treating it as missing preserves the previous not-found semantics.
    expect(parseProjectMarkdown("")).toBeNull();
    expect(parseProjectMarkdown({ v: 1, markdown: "" })).toBeNull();
  });

  it("returns null for unrecoverable shapes", () => {
    // Arrays and non-wrapper objects cannot be mapped back to their original
    // source text faithfully, so they are treated as not found.
    expect(parseProjectMarkdown([1, 2, 3])).toBeNull();
    expect(parseProjectMarkdown({ markdown: "no version" })).toBeNull();
    expect(parseProjectMarkdown({ v: 2, markdown: "future shape" })).toBeNull();
    expect(parseProjectMarkdown({ v: 1, markdown: 42 })).toBeNull();
    expect(parseProjectMarkdown({ v: 1 })).toBeNull();
    expect(parseProjectMarkdown(Number.NaN)).toBeNull();
    expect(parseProjectMarkdown(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
