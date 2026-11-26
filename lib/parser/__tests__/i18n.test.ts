import { describe, expect, it } from "vitest";
import {
  resolveEffectiveLocale,
  resolveLocalizedString,
  resolveSceneTextContent,
} from "../i18n";

const strings = {
  welcome: {
    es: "Bienvenido",
    en: "Welcome",
    fr: "Bienvenue",
  },
  blank: {
    es: "",
    en: "Blank fallback",
  },
  partial: {
    fr: "Français",
  },
};

describe("resolveEffectiveLocale", () => {
  it("uses the scene override before every document/user locale", () => {
    expect(
      resolveEffectiveLocale({
        sceneLocale: "fr",
        activeLocale: "es",
        locales: ["en", "es", "fr"],
        defaultLocale: "en",
      })
    ).toBe("fr");
  });

  it("uses a valid active locale before the document default", () => {
    expect(
      resolveEffectiveLocale({
        activeLocale: "es",
        locales: ["en", "es"],
        defaultLocale: "en",
      })
    ).toBe("es");
  });

  it("ignores an undeclared active locale", () => {
    expect(
      resolveEffectiveLocale({
        activeLocale: "de",
        locales: ["en", "es"],
        defaultLocale: "en",
      })
    ).toBe("en");
  });

  it("falls back to the first declared locale and then undefined", () => {
    expect(resolveEffectiveLocale({ locales: ["es", "fr"] })).toBe("es");
    expect(resolveEffectiveLocale({})).toBeUndefined();
  });
});

describe("resolveLocalizedString fallback chain", () => {
  it("uses the effective locale translation first", () => {
    expect(
      resolveLocalizedString({
        strings,
        key: "welcome",
        locale: "fr",
        defaultLocale: "en",
      })
    ).toBe("Bienvenue");
  });

  it("respects an intentionally empty translation as present", () => {
    expect(
      resolveLocalizedString({
        strings,
        key: "blank",
        locale: "es",
        defaultLocale: "en",
      })
    ).toBe("");
  });

  it("falls back to the document default locale", () => {
    expect(
      resolveLocalizedString({
        strings,
        key: "welcome",
        locale: "de",
        defaultLocale: "en",
      })
    ).toBe("Welcome");
  });

  it("falls back to the first defined translation when the default is absent", () => {
    expect(
      resolveLocalizedString({
        strings,
        key: "partial",
        locale: "es",
        defaultLocale: "en",
      })
    ).toBe("Français");
  });

  it("uses inline content when the key is undefined", () => {
    expect(
      resolveLocalizedString({
        strings,
        key: "missing",
        locale: "es",
        defaultLocale: "en",
        inlineContent: "Inline fallback",
      })
    ).toBe("Inline fallback");
  });

  it("uses inline content when no translation fallback exists", () => {
    expect(
      resolveLocalizedString({
        strings: { empty: {} },
        key: "empty",
        locale: "es",
        inlineContent: "Inline fallback",
      })
    ).toBe("Inline fallback");
  });

  it("uses the literal key as the final debuggable fallback", () => {
    expect(
      resolveLocalizedString({
        strings,
        key: "missing",
        locale: "es",
        defaultLocale: "en",
      })
    ).toBe("missing");
  });

  it("ignores whitespace-only inline content before using the key", () => {
    expect(
      resolveLocalizedString({
        strings,
        key: "missing",
        inlineContent: "  \n  ",
      })
    ).toBe("missing");
  });
});

describe("resolveSceneTextContent", () => {
  it("returns inline content unchanged when there is no i18n key", () => {
    expect(
      resolveSceneTextContent(
        { content: "Plain text" },
        { strings, locale: "es", defaultLocale: "en" }
      )
    ).toBe("Plain text");
  });

  it("resolves SceneText through the same chain", () => {
    expect(
      resolveSceneTextContent(
        { content: "Inline fallback", i18nKey: "welcome" },
        { strings, locale: "es", defaultLocale: "en" }
      )
    ).toBe("Bienvenido");
  });
});
