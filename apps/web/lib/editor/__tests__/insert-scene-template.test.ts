import { describe, expect, it } from "vitest";
import { sceneDirectiveInsertion, sceneTemplateInsertion } from "../insert-scene-template";

const TEMPLATE = "!scene\n!text\nInserted\n!duration 2s";

function apply(markdown: string, insertion: { offset: number; text: string }) {
  return markdown.slice(0, insertion.offset) + insertion.text + markdown.slice(insertion.offset);
}

describe("sceneTemplateInsertion", () => {
  it("inserts before the next scene while preserving existing separator glue", () => {
    const markdown = "!scene\n!text\nOne\n!duration 1s\n\n---\n\n!scene\n!text\nTwo\n!duration 1s";
    const insertion = sceneTemplateInsertion(
      markdown,
      TEMPLATE,
      [
        { startLine: 1, endLine: 4 },
        { startLine: 8, endLine: 11 },
      ],
      0,
    );

    expect(insertion.placement).toBe("after-current-scene");
    expect(apply(markdown, insertion)).toBe(
      "!scene\n!text\nOne\n!duration 1s\n\n---\n\n" +
        `${TEMPLATE}\n\n---\n\n` +
        "!scene\n!text\nTwo\n!duration 1s",
    );
  });

  it("appends after the last scene with one blank line and one separator", () => {
    const markdown = "!scene\n!text\nOne\n!duration 1s\n\n";
    const insertion = sceneTemplateInsertion(
      markdown,
      TEMPLATE,
      [{ startLine: 1, endLine: 4 }],
      0,
    );

    expect(insertion.placement).toBe("append");
    expect(apply(markdown, insertion)).toBe(`${markdown}---\n\n${TEMPLATE}\n`);
  });

  it("uses CRLF for inserted text without rewriting existing CRLF bytes", () => {
    const markdown = "!scene\r\n!text\r\nOne\r\n!duration 1s";
    const insertion = sceneTemplateInsertion(
      markdown,
      TEMPLATE,
      [{ startLine: 1, endLine: 4 }],
      0,
    );

    expect(insertion.text).toContain("\r\n---\r\n\r\n");
    expect(insertion.text).toContain("!text\r\nInserted");
    expect(apply(markdown, insertion).startsWith(markdown)).toBe(true);
  });

  it("falls back to a safe append when source ranges are inconsistent", () => {
    const markdown = "!scene\n!text\nOne";
    const insertion = sceneTemplateInsertion(markdown, TEMPLATE, [undefined], 0);
    expect(insertion.placement).toBe("append");
    expect(apply(markdown, insertion)).toContain(TEMPLATE);
  });
});

describe("sceneDirectiveInsertion", () => {
  const ranges = [
    { startLine: 1, endLine: 4 },
    { startLine: 8, endLine: 11 },
  ];
  const markdown = "!scene\n!text\nOne\n!duration 1s\n\n---\n\n!scene\n!text\nTwo\n!duration 1s";

  it("inserts at the end of the scene containing the cursor", () => {
    const cursor = markdown.indexOf("Two");
    const insertion = sceneDirectiveInsertion(markdown, "!background #123456", ranges, 0, cursor);

    expect(insertion.placement).toBe("inside-current-scene");
    const rewritten = apply(markdown, insertion);
    expect(rewritten).toContain("!scene\n!text\nTwo\n!duration 1s\n!background #123456");
    expect(rewritten.indexOf("!background #123456")).toBeGreaterThan(rewritten.indexOf("Two"));
  });

  it("uses inter-scene glue as belonging to the preceding scene", () => {
    const cursor = markdown.indexOf("---");
    const insertion = sceneDirectiveInsertion(markdown, "!transition fade", ranges, 1, cursor);
    const rewritten = apply(markdown, insertion);

    expect(rewritten).toContain("!duration 1s\n!transition fade\n\n---");
    expect(rewritten.indexOf("!transition fade")).toBeLessThan(rewritten.indexOf("---"));
  });

  it("preserves CRLF pairs when inserting at a line end", () => {
    const crlf = markdown.replace(/\n/g, "\r\n");
    const insertion = sceneDirectiveInsertion(crlf, "!background #123456", ranges, 0, 0);
    const rewritten = apply(crlf, insertion);

    expect(rewritten).toContain("!duration 1s\r\n!background #123456\r\n");
    expect(rewritten).not.toContain("\r!background");
  });

  it("wraps the directive in a minimal scene when no scene exists", () => {
    const insertion = sceneDirectiveInsertion("", "!duration 3s", [], -1, 0);
    expect(insertion.placement).toBe("append");
    expect(insertion.text).toBe("!scene\n!duration 3s\n");
  });
});
