import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../parser/index.js";

describe("parser source maps for scene directives", () => {
  it("maps layout, locale, and callout directives to their source lines", () => {
    const markdown = [
      "!scene",
      "!locale es",
      "!layout split:vertical",
      "left:",
      "!text",
      "Left",
      "right:",
      "!text",
      "Right",
      '!callout "Look here" arrow:left',
      "!duration 3s",
    ].join("\n");

    const [scene] = parseMarkdown(markdown);

    expect(scene.sourceMap?.locale).toEqual({ startLine: 2, endLine: 2 });
    expect(scene.sourceMap?.layout).toEqual({ startLine: 3, endLine: 9 });
    expect(scene.sourceMap?.callout).toEqual({ startLine: 10, endLine: 10 });
  });
});
