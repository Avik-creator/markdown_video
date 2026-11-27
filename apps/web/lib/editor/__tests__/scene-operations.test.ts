import { describe, expect, it } from "vitest";
import { rewriteSceneOperation } from "../scene-operations";

const RANGES = [
  { startLine: 1, endLine: 4 },
  { startLine: 8, endLine: 11 },
  { startLine: 15, endLine: 18 },
];
const DOC = [
  "!scene",
  "!text",
  "One",
  "!duration 1s",
  "",
  "---",
  "",
  "!scene",
  "!text",
  "Two",
  "!duration 2s",
  "",
  "---",
  "",
  "!scene",
  "!text",
  "Three",
  "!duration 3s",
].join("\n");

describe("rewriteSceneOperation duplicate", () => {
  it("duplicates a middle scene with correct separators on both sides", () => {
    const result = rewriteSceneOperation(DOC, RANGES, 1, "duplicate");
    expect(result).toContain(
      "Two\n!duration 2s\n\n---\n\n!scene\n!text\nTwo\n!duration 2s\n\n---\n\n!scene\n!text\nThree",
    );
    expect(result?.split("!scene")).toHaveLength(5);
  });

  it("duplicates the final scene without rewriting the original bytes", () => {
    const result = rewriteSceneOperation(DOC, RANGES, 2, "duplicate");
    expect(result?.startsWith(DOC)).toBe(true);
    expect(result).toContain("!duration 3s\n\n---\n\n!scene\n!text\nThree\n!duration 3s\n");
  });

  it("uses CRLF separators for the duplicate in CRLF documents", () => {
    const crlf = DOC.replace(/\n/g, "\r\n");
    const result = rewriteSceneOperation(crlf, RANGES, 0, "duplicate");
    expect(result).toContain("!duration 1s\r\n\r\n---\r\n\r\n!scene\r\n!text\r\nOne");
  });
});

describe("rewriteSceneOperation delete", () => {
  it("deletes a middle scene and one structural separator", () => {
    const result = rewriteSceneOperation(DOC, RANGES, 1, "delete");
    expect(result).toBe([
      "!scene",
      "!text",
      "One",
      "!duration 1s",
      "",
      "---",
      "",
      "!scene",
      "!text",
      "Three",
      "!duration 3s",
    ].join("\n"));
  });

  it("deletes the first scene with its following separator", () => {
    const result = rewriteSceneOperation(DOC, RANGES, 0, "delete");
    expect(result?.startsWith("!scene\n!text\nTwo")).toBe(true);
    expect(result).not.toContain("One");
  });

  it("deletes the last scene with its preceding separator", () => {
    const result = rewriteSceneOperation(DOC, RANGES, 2, "delete");
    expect(result).toBe([
      "!scene",
      "!text",
      "One",
      "!duration 1s",
      "",
      "---",
      "",
      "!scene",
      "!text",
      "Two",
      "!duration 2s",
    ].join("\n") + "\n");
  });

  it("does not eat comments in inter-scene glue", () => {
    const doc = DOC.replace("\n---\n\n!scene\n!text\nTwo", "\n---\n<!-- keep me -->\n!scene\n!text\nTwo");
    const result = rewriteSceneOperation(doc, RANGES, 1, "delete");
    expect(result).toContain("<!-- keep me -->");
    expect(result).not.toContain("Two");
  });

  it("returns null for inconsistent ranges", () => {
    expect(rewriteSceneOperation(DOC, [undefined], 0, "delete")).toBeNull();
    expect(rewriteSceneOperation(DOC, RANGES, 99, "delete")).toBeNull();
  });
});
