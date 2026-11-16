import { describe, expect, it } from "vitest";
import { getAllDirectives } from "@/lib/mcp/documentation";
import * as C from "@/lib/parser/constants";
import { getCompletions } from "../completions";

/** Completions with the cursor at "|". */
function at(source: string) {
  const cursor = source.indexOf("|");
  const text = source.replace("|", "");
  const result = getCompletions(text, cursor);
  return {
    labels: result?.items.map((i) => i.label) ?? [],
    replaced: result ? text.slice(result.from, result.to) : null,
    result,
    text,
  };
}

describe("directive names", () => {
  it("lists directives after !", () => {
    const { labels, replaced } = at("!scene\n!|");
    expect(labels).toContain("text");
    expect(labels).toContain("transition");
    expect(replaced).toBe("!");
  });

  it("filters by prefix and replaces the typed word", () => {
    const { labels, replaced } = at("!scene\n!tr|");
    expect(labels).toEqual(["transition"]);
    expect(replaced).toBe("!tr");
  });

  it("matches aliases", () => {
    expect(at("!scene\n!im|").labels).toContain("image");
    expect(at("!scene\n!img|").labels).toEqual(["image"]);
  });

  it("ranks name matches above alias matches", () => {
    // "par" is a prefix of "particles" and of the text alias "paragraph".
    expect(at("!scene\n!par|").labels).toEqual(["particles", "text"]);
  });

  it("offers nothing once the directive is complete", () => {
    expect(at("!scene\n!text|").result).toBeNull();
  });
});

describe("directive arguments", () => {
  it("completes key:value arguments", () => {
    const { labels, replaced } = at("!scene\n!chart type:b|");
    expect(labels).toEqual(["bar"]);
    expect(replaced).toBe("b");
  });

  it("completes values after an empty key", () => {
    expect(at("!scene\n!particles type:|").labels).toEqual([...C.PARTICLE_TYPES]);
  });

  it("completes the positional transition type", () => {
    expect(at("!scene\n!transition sl|").labels).toEqual(["slide"]);
    expect(at("!scene\n!trans |").labels).toEqual([...C.TRANSITION_TYPES]);
  });

  it("completes property names that have fixed values", () => {
    const { labels } = at("!scene\n!chart ty|");
    expect(labels).toEqual(["type:"]);
  });

  it("offers booleans for boolean properties", () => {
    expect(at("!scene\n!chart type:bar animate:|").labels).toEqual(["true", "false"]);
  });
});

describe("block properties", () => {
  it("completes animation values inside a text block", () => {
    const { labels, replaced } = at("!scene\n!text\nHello\nanimation: sl|");
    expect(labels).toEqual(["slideUp", "slideDown", "slideLeft", "slideRight"]);
    expect(replaced).toBe("sl");
  });

  it("uses the enclosing block's property set", () => {
    expect(at("!scene\n!text\nHi\nfontFamily: |").labels).toEqual([...C.TEXT_FONT_FAMILIES]);
    expect(at("!scene\n!code\nfontFamily: |").labels).toEqual([...C.CODE_FONT_FAMILIES]);
  });

  it("offers nothing for ordinary text that contains a colon", () => {
    expect(at("!scene\n!text\nNote: hel|").result).toBeNull();
  });

  it("does not look past a scene separator", () => {
    expect(at("!scene\n!text\nHi\n\n---\n\nanimation: |").result).toBeNull();
  });
});

it("offers nothing inside code blocks", () => {
  expect(at("!scene\n!code\n```bash\n!|").result).toBeNull();
});

// Completions come from the MCP docs and validation uses the parser
// constants. If they drift apart, the editor would suggest values the
// validator then rejects.
describe("documentation matches the validator", () => {
  const docs = getAllDirectives();
  const valuesOf = (directive: string, property: string) =>
    docs.find((d) => d.name === directive)?.properties?.find((p) => p.name === property)?.values;

  it.each([
    ["text", "animation", C.ANIMATION_TYPES],
    ["text", "fontFamily", C.TEXT_FONT_FAMILIES],
    ["code", "fontFamily", C.CODE_FONT_FAMILIES],
    ["transition", "type", C.TRANSITION_TYPES],
    ["chart", "type", C.CHART_TYPES],
    ["mockup", "device", C.DEVICE_TYPES],
    ["particles", "type", C.PARTICLE_TYPES],
    ["camera", "effect", C.CAMERA_EFFECTS],
    ["presenter", "position", C.PRESENTER_POSITIONS],
    ["emoji", "animate", C.EMOJI_ANIMATIONS],
    ["countdown", "style", C.COUNTDOWN_STYLES],
    ["progress", "style", C.PROGRESS_STYLES],
    ["image", "fit", C.IMAGE_FIT_OPTIONS],
    ["image", "position", C.IMAGE_POSITIONS],
  ] as const)("%s.%s", (directive, property, expected) => {
    expect(valuesOf(directive, property)).toEqual([...expected]);
  });
});
