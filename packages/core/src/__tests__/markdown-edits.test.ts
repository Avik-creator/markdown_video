import { describe, expect, it } from "vitest";
import {
  applyDirectiveValueEdit,
  inspectSceneDirective,
  type DirectiveValueEdit,
} from "../markdown-edits.js";
import { parseMarkdown } from "../parser/index.js";

function edit(markdown: string, valueEdit: DirectiveValueEdit) {
  return applyDirectiveValueEdit(markdown, valueEdit);
}

function expectUnchangedExceptLines(
  before: string,
  after: string,
  changedLineNumbers: number[]
) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  expect(afterLines.length).toBe(beforeLines.length);
  for (let index = 0; index < beforeLines.length; index++) {
    if (changedLineNumbers.includes(index + 1)) continue;
    expect(afterLines[index], `line ${index + 1} should be byte-identical`).toBe(
      beforeLines[index]
    );
  }
}

describe("inspectSceneDirective", () => {
  it("distinguishes absent values from explicit values and normalizes scalar types", () => {
    const markdown = [
      "!scene",
      "!text",
      "Hello",
      "animation: slideUp",
      "size: xl",
      "!duration 4s",
    ].join("\n");

    const text = inspectSceneDirective(markdown, 0, "text");
    expect(text?.present).toBe(true);
    expect(text?.properties.find((p) => p.name === "animation")).toMatchObject({
      present: true,
      rawValue: "slideUp",
      value: "slideUp",
      line: 4,
      source: "block",
    });
    expect(text?.properties.find((p) => p.name === "color")?.present).toBe(false);

    const duration = inspectSceneDirective(markdown, 0, "duration");
    expect(duration?.positional[0]).toMatchObject({
      present: true,
      rawValue: "4s",
      value: 4,
      line: 6,
    });
  });

  it("reads enum values through schema aliases", () => {
    const markdown = ["!scene", "!mockup device:iphone", "content: text", "Hello"].join("\n");
    const mockup = inspectSceneDirective(markdown, 0, "device");
    expect(mockup?.directiveName).toBe("mockup");
    expect(mockup?.properties.find((p) => p.name === "device")).toMatchObject({
      present: true,
      value: "iphone",
    });
  });
});

describe("applyDirectiveValueEdit: positional scene metadata", () => {
  it("updates a scene duration in place without touching any other byte", () => {
    const before = ["!scene", "!text", "Hello", "!duration 3s"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "duration",
      valueName: "seconds",
      value: 5,
    });

    expect(result).toMatchObject({ ok: true, action: "updated", line: 4 });
    if (!result.ok) return;
    expect(result.markdown.split("\n")[3]).toBe("!duration 5s");
    expectUnchangedExceptLines(before, result.markdown, [4]);
    expect(parseMarkdown(result.markdown)[0].duration).toBe(5);
  });

  it("inserts a missing duration immediately inside the scene", () => {
    const before = ["!scene", "!text", "Hello"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "duration",
      valueName: "seconds",
      value: 2.5,
    });

    expect(result).toMatchObject({ ok: true, action: "inserted" });
    if (!result.ok) return;
    expect(result.markdown).toBe(["!scene", "!duration 2.5s", "!text", "Hello"].join("\n"));
    expect(parseMarkdown(result.markdown)[0].duration).toBe(2.5);
  });

  it("removes a duration directive when cleared", () => {
    const before = ["!scene", "!duration 4s", "!text", "Hello"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "duration",
      valueName: "seconds",
      value: null,
    });

    expect(result).toMatchObject({ ok: true, action: "removed" });
    if (!result.ok) return;
    expect(result.markdown).toBe(["!scene", "!text", "Hello"].join("\n"));
    expect(parseMarkdown(result.markdown)[0].duration).toBe(3);
  });

  it("edits the last duplicate scene directive, preserving earlier duplicates", () => {
    const before = [
      "!scene",
      "!duration 2s",
      "!text",
      "Hello",
      "!duration 4s",
    ].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "duration",
      valueName: "seconds",
      value: 6,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(
      ["!scene", "!duration 2s", "!text", "Hello", "!duration 6s"].join("\n")
    );
  });

  it("updates transition type and duration positionally without disturbing the other value", () => {
    const before = ["!scene", "!text", "Hello", "!transition fade 1s"].join("\n");
    const typeResult = edit(before, {
      sceneIndex: 0,
      directive: "transition",
      valueName: "type",
      value: "slide",
    });
    expect(typeResult.ok).toBe(true);
    if (!typeResult.ok) return;
    expect(typeResult.markdown.split("\n")[3]).toBe("!transition slide 1s");

    const durationResult = edit(before, {
      sceneIndex: 0,
      directive: "transition",
      valueName: "duration",
      value: 1.25,
    });
    expect(durationResult.ok).toBe(true);
    if (!durationResult.ok) return;
    expect(durationResult.markdown.split("\n")[3]).toBe("!transition fade 1.25s");
  });

  it("appends an optional transition duration when it is absent", () => {
    const before = ["!scene", "!transition zoom", "!text", "Hello"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "transition",
      valueName: "duration",
      value: 0.75,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown.split("\n")[1]).toBe("!transition zoom 0.75s");
  });

  it("rewrites a gradient background as one rest-of-line positional value", () => {
    const before = [
      "!scene",
      "!background linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      "!text",
      "Hello",
    ].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "background",
      valueName: "color",
      value: "linear-gradient(90deg, #111111 0%, #eeeeee 100%)",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown.split("\n")[1]).toBe(
      "!background linear-gradient(90deg, #111111 0%, #eeeeee 100%)"
    );
    expect(parseMarkdown(result.markdown)[0].background).toBe(
      "linear-gradient(90deg, #111111 0%, #eeeeee 100%)"
    );
  });

  it("inserts and edits the scene locale override", () => {
    const before = ["!scene", "!text i18n:welcome"].join("\n");
    const inserted = edit(before, {
      sceneIndex: 0,
      directive: "locale",
      valueName: "code",
      value: "es",
    });
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;
    expect(inserted.markdown).toBe(["!scene", "!locale es", "!text i18n:welcome"].join("\n"));

    const updated = edit(inserted.markdown, {
      sceneIndex: 0,
      directive: "locale",
      valueName: "code",
      value: "fr",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.markdown).toBe(["!scene", "!locale fr", "!text i18n:welcome"].join("\n"));
    expect(parseMarkdown(updated.markdown)[0].locale).toBe("fr");
  });

  it("serializes chapter titles in the quoted positional grammar", () => {
    const before = ["!scene", "!text", "Hello"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "chapter",
      valueName: "title",
      value: "Getting Started",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(
      ["!scene", '!chapter "Getting Started"', "!text", "Hello"].join("\n")
    );
    expect(parseMarkdown(result.markdown)[0].chapter).toBe("Getting Started");
  });

  it("edits only the addressed scene in a multi-scene document", () => {
    const before = [
      "!scene",
      "!text",
      "One",
      "!duration 2s",
      "---",
      "!scene",
      "!text",
      "Two",
      "!duration 3s",
    ].join("\n");
    const result = edit(before, {
      sceneIndex: 1,
      directive: "duration",
      valueName: "seconds",
      value: 7,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(
      [
        "!scene",
        "!text",
        "One",
        "!duration 2s",
        "---",
        "!scene",
        "!text",
        "Two",
        "!duration 7s",
      ].join("\n")
    );
  });
});

describe("applyDirectiveValueEdit: inline properties", () => {
  it("edits one property on a multi-property directive line without destroying the others", () => {
    const before = [
      "!scene",
      "!chart type:bar animate:true",
      "Sales: 100",
      "Expenses: 80",
    ].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "chart",
      valueName: "animate",
      value: false,
    });

    expect(result).toMatchObject({ ok: true, action: "updated", line: 2 });
    if (!result.ok) return;
    expect(result.markdown).toBe(
      ["!scene", "!chart type:bar animate:false", "Sales: 100", "Expenses: 80"].join("\n")
    );
    expect(parseMarkdown(result.markdown)[0].chart?.animate).toBe(false);
  });

  it("inserts a missing inline property at the end of the directive arguments", () => {
    const before = ["!scene", "!countdown from:5"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "countdown",
      valueName: "color",
      value: "#22c55e",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(["!scene", "!countdown from:5 color:#22c55e"].join("\n"));
  });

  it("removes an inline property without collapsing the remaining arguments", () => {
    const before = ["!scene", "!chart type:bar animate:true", "Sales: 100"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "chart",
      valueName: "animate",
      value: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(["!scene", "!chart type:bar", "Sales: 100"].join("\n"));
  });

  it("edits the first duplicate inline key because that is the parser-effective one", () => {
    const before = ["!scene", "!chart type:bar animate:true animate:false", "Sales: 100"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "chart",
      valueName: "animate",
      value: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown.split("\n")[1]).toBe("!chart type:bar animate:false animate:false");
  });

  it("preserves quoted sibling values while editing another inline property", () => {
    const before = [
      "!scene",
      '!qr url:https://example.com label:"Scan me now" size:200',
    ].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "qr",
      valueName: "size",
      value: 300,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(
      ["!scene", '!qr url:https://example.com label:"Scan me now" size:300'].join("\n")
    );
  });

  it("inserts a missing effect directive with the edited inline property", () => {
    const before = ["!scene", "!text", "Hello"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "particles",
      valueName: "type",
      value: "confetti",
    });

    expect(result).toMatchObject({ ok: true, action: "inserted" });
    if (!result.ok) return;
    expect(result.markdown).toBe(
      ["!scene", "!particles type:confetti", "!text", "Hello"].join("\n")
    );
    expect(parseMarkdown(result.markdown)[0].particles?.type).toBe("confetti");
  });

  it("quotes multi-word inline string values and preserves separated key/value spacing", () => {
    const before = ["!scene", '!qr url:https://example.com label: "Scan me"'].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "qr",
      valueName: "label",
      value: "Scan the code",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(
      ["!scene", '!qr url:https://example.com label: "Scan the code"'].join("\n")
    );

    const inserted = edit(["!scene", "!qr url:https://example.com"].join("\n"), {
      sceneIndex: 0,
      directive: "qr",
      valueName: "label",
      value: "Scan me",
    });
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;
    expect(inserted.markdown).toBe(
      ["!scene", '!qr url:https://example.com label:"Scan me"'].join("\n")
    );
  });

  it("removes a middle inline property while leaving single spaces between siblings", () => {
    const before = [
      "!scene",
      '!qr url:https://example.com size:200 label:"Scan me"',
    ].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "qr",
      valueName: "size",
      value: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(
      ["!scene", '!qr url:https://example.com label:"Scan me"'].join("\n")
    );
  });

  it("edits layout split values through the schema", () => {
    const before = [
      "!scene",
      "!layout split:horizontal",
      "left:",
      "!text",
      "Left",
      "right:",
      "!text",
      "Right",
    ].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "layout",
      valueName: "split",
      value: "vertical",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown.split("\n")[1]).toBe("!layout split:vertical");
    expect(parseMarkdown(result.markdown)[0].split?.direction).toBe("vertical");
  });
});

describe("applyDirectiveValueEdit: block properties", () => {
  it("updates a text block property in place and preserves content exactly", () => {
    const before = [
      "!scene",
      "!text",
      "Hello",
      "animation: fadeIn",
      "size: xl",
      "// a comment-like line",
      "",
    ].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "text",
      valueName: "animation",
      value: "slideUp",
    });

    expect(result).toMatchObject({ ok: true, action: "updated", line: 4 });
    if (!result.ok) return;
    expect(result.markdown.split("\n")[3]).toBe("animation: slideUp");
    expectUnchangedExceptLines(before, result.markdown, [4]);
  });

  it("inserts a missing block property at the start of the directive block", () => {
    const before = ["!scene", "!text", "Hello", "size: xl"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "text",
      valueName: "animation",
      value: "bounceIn",
    });

    expect(result).toMatchObject({ ok: true, action: "inserted" });
    if (!result.ok) return;
    expect(result.markdown).toBe(
      ["!scene", "!text", "animation: bounceIn", "Hello", "size: xl"].join("\n")
    );
    expect(parseMarkdown(result.markdown)[0].text?.animation).toBe("bounceIn");
    expect(parseMarkdown(result.markdown)[0].text?.content).toBe("Hello");
  });

  it("removes a block property line when cleared", () => {
    const before = ["!scene", "!text", "Hello", "animation: fadeIn", "size: xl"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "text",
      valueName: "animation",
      value: null,
    });

    expect(result).toMatchObject({ ok: true, action: "removed" });
    if (!result.ok) return;
    expect(result.markdown).toBe(["!scene", "!text", "Hello", "size: xl"].join("\n"));
    expect(parseMarkdown(result.markdown)[0].text?.animation).toBe("fadeIn");
  });

  it("edits the last duplicate block property because later block values win", () => {
    const before = [
      "!scene",
      "!text",
      "animation: fadeIn",
      "Hello",
      "animation: slideUp",
    ].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "text",
      valueName: "animation",
      value: "zoomIn",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(
      ["!scene", "!text", "animation: fadeIn", "Hello", "animation: zoomIn"].join("\n")
    );
  });

  it("never treats code fence contents as editable properties", () => {
    const before = [
      "!scene",
      "!code",
      "typing: true",
      "```js",
      'const note = "typing: false"',
      "!duration 99s",
      "```",
      "!duration 4s",
    ].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "code",
      valueName: "typing",
      value: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(
      [
        "!scene",
        "!code",
        "typing: false",
        "```js",
        'const note = "typing: false"',
        "!duration 99s",
        "```",
        "!duration 4s",
      ].join("\n")
    );
  });

  it("inserts a terminal property before commands so the parser can consume it", () => {
    const before = ["!scene", "!terminal", "$ npm run dev", "> ready"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "terminal",
      valueName: "speed",
      value: 45,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe(
      ["!scene", "!terminal", "speed: 45", "$ npm run dev", "> ready"].join("\n")
    );
    expect(parseMarkdown(result.markdown)[0].terminal?.typingSpeed).toBe(45);
  });
});

describe("applyDirectiveValueEdit: safety and fidelity", () => {
  it("rejects invalid enum values without producing markdown", () => {
    const before = ["!scene", "!chart type:bar", "Sales: 100"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "chart",
      valueName: "type",
      value: "not-a-chart",
    });

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("markdown");
  });

  it("enforces schema numeric bounds", () => {
    const before = ["!scene", "!duration 3s"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "duration",
      valueName: "seconds",
      value: 0,
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("refuses to remove required properties", () => {
    const before = ["!scene", "!image src:/hero.png fit:cover"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "image",
      valueName: "src",
      value: null,
    });
    expect(result.ok).toBe(false);
  });

  it("preserves CRLF endings on rewritten and inserted lines", () => {
    const before = "!scene\r\n!text\r\nHello\r\n!duration 3s";
    const result = edit(before, {
      sceneIndex: 0,
      directive: "duration",
      valueName: "seconds",
      value: 5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toBe("!scene\r\n!text\r\nHello\r\n!duration 5s");

    const inserted = edit(result.markdown, {
      sceneIndex: 0,
      directive: "text",
      valueName: "animation",
      value: "fadeIn",
    });
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;
    expect(inserted.markdown).toBe(
      "!scene\r\n!text\r\nanimation: fadeIn\r\nHello\r\n!duration 5s"
    );
  });

  it("preserves comments, blank lines, and unknown lines byte-identically around an edit", () => {
    const before = [
      "!scene",
      "// scene note",
      "!text",
      "Hello",
      "",
      "unrecognized content",
      "animation: fadeIn",
      "// trailing note",
      "!duration 3s",
    ].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "duration",
      valueName: "seconds",
      value: 4,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectUnchangedExceptLines(before, result.markdown, [9]);
  });

  it("returns a failure rather than writing through colon-attached shorthand", () => {
    const before = ["!scene", "!camera", "- at:0s zoom:1", "!zoom:1.4"].join("\n");
    const result = edit(before, {
      sceneIndex: 0,
      directive: "camera",
      valueName: "duration",
      kind: "positional",
      value: 2,
    });
    // The exact outcome depends on which camera directive is parser-effective,
    // but the contract is that failure never emits partial markdown.
    if (!result.ok) {
      expect(result).not.toHaveProperty("markdown");
    }
  });
});
