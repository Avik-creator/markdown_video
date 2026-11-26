import { describe, expect, it } from "vitest";
import { validateMarkdownSyntax } from "../syntax-validator";

const messages = (items: { message: string }[]) => items.map((item) => item.message);

describe("directive shorthand validation", () => {
  it.each([
    ["!pan", "!scene\n!pan\n"],
    ["!zoom", "!scene\n!zoom\n"],
    ["!zoom:1.3", "!scene\n!zoom:1.3\n"],
    ["!split:vertical", "!scene\n!split:vertical\n"],
    ["!device:iphone", "!scene\n!device:iphone\nhello\n"],
    ["!camera pan:0.5", "!scene\n!camera pan:0.5\n"],
    ["!camera zoom:1.5 duration:2s", "!scene\n!camera zoom:1.5 duration:2s\n"],
    ["!move", "!scene\n!move\n"],
  ] as const)("accepts %s", (_label, markdown) => {
    const result = validateMarkdownSyntax(markdown);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe("variable-aware validation", () => {
  it.each([
    [
      "scene duration",
      "!var d 3\n!scene\n!duration $d\n",
    ],
    [
      "text animation",
      "!var anim fadeIn\n!scene\n!text\nHi\nanimation: $anim\n",
    ],
    [
      "camera value",
      "!var z 1.5\n!scene\n!camera zoom:$z\n",
    ],
  ] as const)("validates a substituted %s normally", (_label, markdown) => {
    const result = validateMarkdownSyntax(markdown);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("uses the parser's hoisted variable semantics for uses before definitions", () => {
    const result = validateMarkdownSyntax(`!scene
!duration $d
!text
Hi
!var d 3
`);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("validates a defined variable's substituted invalid value normally", () => {
    const result = validateMarkdownSyntax(`!var d 0
!scene
!duration $d
!text
Hi
`);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      line: 3,
      message: "Scene 1: Scene duration must be greater than 0",
    });
  });

  it("does not flag values that still contain unresolved variable references", () => {
    const result = validateMarkdownSyntax(`!scene
!duration $missingDuration
!camera zoom:$missingZoom
!text
Hi
animation: $missingAnimation
`);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe("camera inline and keyframe validation", () => {
  it("accepts numeric inline pan intensity", () => {
    const result = validateMarkdownSyntax("!scene\n!camera pan:0.5\n");

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("accepts a direction enum in a camera keyframe", () => {
    const result = validateMarkdownSyntax(`!scene
!camera
- at:0s pan:left
`);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("rejects a numeric value in the keyframe pan direction position", () => {
    const result = validateMarkdownSyntax(`!scene
!camera
- at:0s pan:0.5
`);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      line: 3,
      message: 'Scene 1: Invalid camera pan direction "0.5"',
    });
  });
});

describe("scene duration validation", () => {
  it("reports exactly one schema error for !duration 0", () => {
    const result = validateMarkdownSyntax(`!scene
!duration 0
!text
Hi
`);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      line: 2,
      message: "Scene 1: Scene duration must be greater than 0",
    });
  });
});

describe("prose and property validation", () => {
  it("does not warn for a capitalized sentence-like color line", () => {
    const result = validateMarkdownSyntax(`!scene
!text
Hi
Color: red is my favorite
`);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.scenes[0].text).toMatchObject({
      content: "Hi\nColor: red is my favorite",
      color: undefined,
    });
  });

  it.each([
    ["named color", "color: red"],
    ["functional color", "color: rgb(255, 0, 0)"],
    ["quoted multi-word color", 'color: "light blue"'],
    ["valid animation", "animation: typewriter"],
  ] as const)("accepts %s as a property without warnings", (_label, propertyLine) => {
    const result = validateMarkdownSyntax(`!scene
!text
Hi
${propertyLine}
`);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it.each([
    [
      "size: large and in charge",
      "Scene 1: looks like property `size` but `large and in charge` is not valid; treating as text",
    ],
    [
      "animation: typrewriter",
      "Scene 1: looks like property `animation` but `typrewriter` is not valid; treating as text",
    ],
    [
      "color: red is my favorite",
      "Scene 1: looks like property `color` but `red is my favorite` is not valid; treating as text",
    ],
  ] as const)("warns rather than errors for likely property typo %s", (propertyLine, warning) => {
    const result = validateMarkdownSyntax(`!scene
!text
Hi
${propertyLine}
`);

    expect(result.errors).toEqual([]);
    expect(messages(result.warnings)).toEqual([warning]);
    expect(result.valid).toBe(true);
  });

  it("does not warn for case-mismatched keys because they are prose by specification", () => {
    const result = validateMarkdownSyntax(`!scene
!text
Hi
FontFamily: not-a-font
`);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.scenes[0].text?.content).toBe("Hi\nFontFamily: not-a-font");
  });
});
