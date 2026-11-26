import { describe, expect, it } from "vitest";
import {
  DIRECTIVE_SCHEMAS,
  getDirectiveProperty,
  getDirectiveSchema,
  getDirectiveValueOptions,
} from "../directive-schema.js";
import { getAllDirectives } from "../documentation.js";
import * as C from "../parser/constants.js";

const EXPECTED_CANONICAL_DIRECTIVES = [
  "scene",
  "text",
  "code",
  "terminal",
  "image",
  "chart",
  "diff",
  "mockup",
  "emoji",
  "qr",
  "countdown",
  "progress",
  "transition",
  "particles",
  "camera",
  "presenter",
  "callout",
  "layout",
  "duration",
  "background",
  "chapter",
  "var",
  "locale",
  "locales",
  "strings",
  "export",
].sort();

describe("directive schema coverage", () => {
  it("defines every canonical directive exactly once", () => {
    const names = DIRECTIVE_SCHEMAS.map((directive) => directive.name);
    expect([...names].sort()).toEqual(EXPECTED_CANONICAL_DIRECTIVES);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has no duplicate aliases or aliases that shadow canonical directives", () => {
    const canonical = new Set<string>(DIRECTIVE_SCHEMAS.map((directive) => directive.name));
    const seen = new Map<string, string>();

    for (const directive of DIRECTIVE_SCHEMAS) {
      for (const alias of directive.aliases) {
        const normalized = alias.toLowerCase();
        expect(canonical.has(normalized), `alias ${alias} shadows a canonical directive`).toBe(false);
        expect(seen.get(normalized), `alias ${alias} is defined twice`).toBeUndefined();
        seen.set(normalized, directive.name);
      }
    }
  });

  it("generates typed parser case keys for exactly the canonical directives", () => {
    expect(Object.keys(C.DIRECTIVE_CASES).sort()).toEqual(
      EXPECTED_CANONICAL_DIRECTIVES.map((name) => name.toUpperCase()).sort()
    );
    expect(Object.values(C.DIRECTIVE_CASES).sort()).toEqual(EXPECTED_CANONICAL_DIRECTIVES);
  });

  it("schema aliases are the same aliases exposed to the parser", () => {
    const parserAliases = new Map<string, string[]>();
    for (const [alias, canonical] of Object.entries(C.KEYWORD_ALIASES)) {
      parserAliases.set(canonical, [...(parserAliases.get(canonical) ?? []), alias]);
    }

    for (const directive of DIRECTIVE_SCHEMAS) {
      expect(
        [...directive.aliases].sort(),
        `aliases for ${directive.name}`
      ).toEqual((parserAliases.get(directive.name) ?? []).sort());
    }
  });

  it("keeps the full backwards-compatible alias sets", () => {
    expect(getDirectiveSchema("code")?.aliases).toEqual(
      expect.arrayContaining(["snippet", "block", "codeblock", "syntax"])
    );
    expect(getDirectiveSchema("terminal")?.aliases).toEqual(
      expect.arrayContaining(["shell", "cli", "console", "cmd", "bash"])
    );
    expect(getDirectiveSchema("chart")?.aliases).toEqual(
      expect.arrayContaining(["graph", "plot", "data"])
    );
    expect(getDirectiveSchema("text")?.aliases).toEqual(
      expect.arrayContaining(["heading", "title", "h1", "h2", "h3", "paragraph", "p"])
    );
    expect(getDirectiveSchema("duration")?.aliases).toEqual(
      expect.arrayContaining(["time", "length", "dur"])
    );
    expect(getDirectiveSchema("background")?.aliases).toEqual(
      expect.arrayContaining(["bg", "color", "fill"])
    );
    expect(getDirectiveSchema("transition")?.aliases).toEqual(
      expect.arrayContaining(["trans", "effect", "animation"])
    );
    expect(getDirectiveSchema("layout")?.aliases).toEqual(
      expect.arrayContaining(["split", "two-column", "columns"])
    );
  });
});

describe("directive schema values and defaults", () => {
  it.each([
    ["text", "animation", C.ANIMATION_TYPES],
    ["text", "size", C.TEXT_SIZES],
    ["text", "fontFamily", C.TEXT_FONT_FAMILIES],
    ["code", "fontSize", C.CODE_FONT_SIZES],
    ["code", "fontFamily", C.CODE_FONT_FAMILIES],
    ["transition", "type", C.TRANSITION_TYPES],
    ["chart", "type", C.CHART_TYPES],
    ["mockup", "device", C.DEVICE_TYPES],
    ["particles", "type", C.PARTICLE_TYPES],
    ["particles", "intensity", C.PARTICLE_INTENSITIES],
    ["camera", "effect", C.CAMERA_EFFECTS],
    ["presenter", "position", C.PRESENTER_POSITIONS],
    ["presenter", "size", C.PRESENTER_SIZES],
    ["presenter", "shape", C.PRESENTER_SHAPES],
    ["emoji", "size", C.TEXT_SIZES],
    ["emoji", "animate", C.EMOJI_ANIMATIONS],
    ["countdown", "style", C.COUNTDOWN_STYLES],
    ["progress", "style", C.PROGRESS_STYLES],
    ["image", "fit", C.IMAGE_FIT_OPTIONS],
    ["image", "position", C.IMAGE_POSITIONS],
  ] as const)("%s.%s values come from the schema", (directive, property, expected) => {
    expect(getDirectiveValueOptions(directive, property)).toEqual(expected);
  });

  it("uses 0.5s as the single transition duration default", () => {
    const duration = getDirectiveSchema("transition")?.positional?.find(
      (argument) => argument.name === "duration"
    );
    expect(duration?.default).toBe(0.5);
    expect(C.DEFAULTS.transitionDuration).toBe(0.5);
  });

  it("documents the QR background syntax key as bg, not the internal bgColor field", () => {
    const qr = getDirectiveSchema("qr");
    expect(qr?.properties?.some((property) => property.name === "bg")).toBe(true);
    expect(qr?.properties?.some((property) => property.name === "bgColor")).toBe(false);

    const doc = getAllDirectives().find((directive) => directive.name === "qr");
    expect(doc?.properties?.some((property) => property.name === "bg")).toBe(true);
    expect(doc?.properties?.some((property) => property.name === "bgColor")).toBe(false);
  });

  it("matches font property keys case-insensitively and returns canonical spellings", () => {
    expect(getDirectiveProperty("code", "fontsize")?.name).toBe("fontSize");
    expect(getDirectiveProperty("code", "FontSize")?.name).toBe("fontSize");
    expect(getDirectiveProperty("code", "fontfamily")?.name).toBe("fontFamily");
    expect(getDirectiveProperty("code", "FONTFAMILY")?.name).toBe("fontFamily");
    expect(getDirectiveProperty("text", "fontfamily")?.name).toBe("fontFamily");
  });

  it("keeps important defaults synchronized with parser constants", () => {
    expect(getDirectiveProperty("text", "size")?.default).toBe("lg");
    expect(getDirectiveProperty("code", "fontSize")?.default).toBe("sm");
    expect(getDirectiveProperty("particles", "intensity")?.default).toBe("medium");
    expect(getDirectiveProperty("presenter", "size")?.default).toBe("md");
    expect(getDirectiveProperty("presenter", "shape")?.default).toBe("circle");
    expect(getDirectiveProperty("emoji", "size")?.default).toBe("xl");
    expect(getDirectiveProperty("callout", "style")?.default).toBe("info");
  });
});

describe("schema-generated MCP documentation", () => {
  it("uses exactly the schema aliases and examples", () => {
    const docs = getAllDirectives();
    expect(docs).toHaveLength(DIRECTIVE_SCHEMAS.length);

    for (const schema of DIRECTIVE_SCHEMAS) {
      const doc = docs.find((directive) => directive.name === schema.name);
      expect(doc, schema.name).toBeDefined();
      expect(doc?.aliases).toEqual([...schema.aliases]);
      expect(doc?.examples).toEqual([...schema.examples]);
      expect(doc?.syntax).toBe(schema.syntax);
      expect(doc?.description).toBe(schema.description);
    }
  });
});
