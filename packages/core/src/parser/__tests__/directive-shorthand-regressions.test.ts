import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../index.js";
import { parseDirective } from "../utils.js";

describe("colon-attached directive shorthand", () => {
  it("injects the invoked directive word into a colon-attached first token", () => {
    expect(parseDirective("!zoom:1.3 duration:2s")).toMatchObject({
      name: "zoom",
      canonicalName: "camera",
      args: "zoom:1.3 duration:2s",
    });
    expect(parseDirective("!split:vertical")?.args).toBe("split:vertical");
    expect(parseDirective("!device:iphone")?.args).toBe("device:iphone");
  });

  it("does not inject when whitespace precedes the colon", () => {
    expect(parseDirective("!zoom :1.3")?.args).toBe(":1.3");
  });

  it.each([
    ["!pan", "pan", 1.5, 1],
    ["!pan:0.5", "pan", 0.5, 1],
    ["!zoom:1.3", "zoom", 1.3, 1],
    ["!zoom", "zoom", 1.5, 1],
    ["!camera pan:0.5", "pan", 0.5, 1],
    ["!camera zoom:1.5 duration:2s", "zoom", 1.5, 2],
  ] as const)("parses %s with its pre-refactor camera meaning", (directive, effect, value, duration) => {
    const [scene] = parseMarkdown(`!scene\n${directive}\n`);

    expect(scene.camera).toEqual({
      effect,
      value,
      duration,
      keyframes: undefined,
    });
  });

  it("documents that !move is a camera alias but not an effect hint", () => {
    const [scene] = parseMarkdown("!scene\n!move\n");

    expect(scene.camera).toMatchObject({
      effect: "zoom",
      value: 1.5,
      duration: 1,
    });
  });

  it("lets an explicitly supplied camera effect override the alias hint", () => {
    const [scene] = parseMarkdown("!scene\n!pan zoom:1.2\n");

    expect(scene.camera).toMatchObject({
      effect: "zoom",
      value: 1.2,
    });
  });

  it("parses the layout split shorthand", () => {
    const [scene] = parseMarkdown("!scene\n!split:vertical\n");

    expect(scene.type).toBe("split");
    expect(scene.split?.direction).toBe("vertical");
  });

  it("parses the mockup device shorthand", () => {
    const [scene] = parseMarkdown("!scene\n!device:iphone\nhello\n");

    expect(scene.type).toBe("mockup");
    expect(scene.mockup?.device).toBe("iphone");
  });
});

describe("prose versus property lines", () => {
  it("preserves sentence-like capitalized color lines as prose", () => {
    const [scene] = parseMarkdown(`!scene
!text
Hi
Color: red is my favorite
`);

    expect(scene.text).toMatchObject({
      content: "Hi\nColor: red is my favorite",
      color: undefined,
    });
  });

  it("preserves unquoted multi-word color values as prose", () => {
    const [scene] = parseMarkdown(`!scene
!text
Hi
color: red is my favorite
`);

    expect(scene.text).toMatchObject({
      content: "Hi\ncolor: red is my favorite",
      color: undefined,
    });
  });

  it("preserves typed values that do not parse as prose in text blocks", () => {
    const [scene] = parseMarkdown(`!scene
!text
Hi
size: large and in charge
animation: typrewriter
`);

    expect(scene.text).toMatchObject({
      content: "Hi\nsize: large and in charge\nanimation: typrewriter",
      animation: "fadeIn",
      size: "lg",
    });
  });

  it("keeps valid lowercase property lines as properties", () => {
    const [scene] = parseMarkdown(`!scene
!text
Hi
color: red
animation: typewriter
size: xl
fontFamily: DISPLAY
`);

    expect(scene.text).toMatchObject({
      content: "Hi",
      color: "red",
      animation: "typewriter",
      size: "xl",
      fontFamily: "display",
    });
  });

  it("accepts functional color notation containing spaces", () => {
    const [scene] = parseMarkdown(`!scene
!text
Hi
color: rgb(255, 0, 0)
`);

    expect(scene.text).toMatchObject({
      content: "Hi",
      color: "rgb(255, 0, 0)",
    });
  });

  it("accepts quoted multi-word free-form color values", () => {
    const [scene] = parseMarkdown(`!scene
!text
Hi
color: "light blue"
`);

    expect(scene.text).toMatchObject({
      content: "Hi",
      color: "light blue",
    });
  });

  it("accepts legacy lowercase spellings of camelCase property keys", () => {
    // The pre-refactor parser lowercased every block key, so documents in the
    // wild use the lowercase spellings `fontfamily`/`fontsize`/`i18nkey`. The
    // case-sensitive prose rule must not silently turn those into prose.
    const [scene] = parseMarkdown(`!scene
!text
Hi
fontfamily: mono
`);
    expect(scene.text).toMatchObject({ content: "Hi", fontFamily: "mono" });

    const [codeScene] = parseMarkdown(`!scene
!code
fontsize: lg
fontfamily: mono
\`\`\`js
const x = 1
\`\`\`
`);
    expect(codeScene.code).toMatchObject({ fontSize: "lg", fontFamily: "mono" });
  });

  it("uses the same prose rules for text inside mockups", () => {
    const [scene] = parseMarkdown(`!scene
!device:iphone
Hi
Color: red is my favorite
`);

    expect(scene.mockup?.content.text).toMatchObject({
      content: "Hi\nColor: red is my favorite",
      color: undefined,
    });
  });
});
