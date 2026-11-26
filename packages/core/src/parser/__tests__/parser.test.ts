import { describe, expect, it } from "vitest";
import { parseMarkdown, parseMarkdownFull } from "../index.js";

const doc = `!var brand #3b82f6

!scene
!duration 4
!background $brand
!transition fade 1s
!text
Hello
animation: fadeIn

---

!scene
!code
\`\`\`ts
const x = 1;
\`\`\`

---

!scene
!terminal
$ npm install
added 1 package
`;

describe("parseMarkdownFull", () => {
  const result = parseMarkdownFull(doc);

  it("splits scenes on --- and detects each scene type", () => {
    expect(result.scenes.map((s) => s.type)).toEqual(["text", "code", "terminal"]);
  });

  it("collects and substitutes variables", () => {
    expect(result.variables).toEqual({ brand: "#3b82f6" });
    expect(result.scenes[0].background).toBe("#3b82f6");
  });

  it("reads scene directives", () => {
    const [text] = result.scenes;
    expect(text.duration).toBe(4);
    expect(text.transition).toBe("fade");
    expect(text.transitionDuration).toBe(1);
    expect(text.text).toMatchObject({ content: "Hello", animation: "fadeIn" });
  });

  it("gives scenes without !duration a default duration", () => {
    expect(result.scenes[1].duration).toBe(3);
    expect(result.scenes[2].duration).toBe(3);
  });

  it("parses fenced code with its language", () => {
    expect(result.scenes[1].code).toMatchObject({ language: "ts", content: "const x = 1;" });
  });

  it("parses terminal commands and output", () => {
    expect(result.scenes[2].terminal?.commands).toEqual([
      { prompt: "$", command: "npm install", output: "added 1 package" },
    ]);
  });

  it("maps scenes back to source lines for the editor", () => {
    expect(result.scenes[0].sourceMap?.scene).toEqual({ startLine: 3, endLine: 10 });
    expect(result.scenes[0].sourceMap?.duration).toEqual({ startLine: 4, endLine: 4 });
  });
});

describe("parseMarkdown", () => {
  it("returns no scenes for an empty document", () => {
    expect(parseMarkdown("")).toEqual([]);
  });

  it("gives every scene a unique id", () => {
    const ids = parseMarkdown(doc).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
