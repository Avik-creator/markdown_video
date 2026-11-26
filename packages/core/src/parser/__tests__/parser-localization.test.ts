import { describe, expect, it } from "vitest";
import { parseMarkdownFull } from "../index.js";

describe("localization parsing", () => {
  it("parses document locales and uses the first valid locale as the default", () => {
    const result = parseMarkdownFull(`!locales en es fr pt-BR zh_CN
!scene
!text
Hello
`);

    expect(result.locales).toEqual(["en", "es", "fr", "pt-BR", "zh_CN"]);
    expect(result.defaultLocale).toBe("en");
  });

  it("deduplicates locales and ignores malformed tokens leniently", () => {
    const result = parseMarkdownFull("!locales en es en pt-BR bad,locale -bad");

    expect(result.locales).toEqual(["en", "es", "pt-BR"]);
    expect(result.defaultLocale).toBe("en");
  });

  it("lets the most recent non-empty !locales directive replace the previous list", () => {
    const result = parseMarkdownFull("!locales en es\n!locales fr de");

    expect(result.locales).toEqual(["fr", "de"]);
    expect(result.defaultLocale).toBe("fr");
  });

  it("parses multiple keys with quoted, single-quoted, and unquoted translations", () => {
    const result = parseMarkdownFull(`!locales en es fr
!strings
welcome:
  en: "Welcome"
  es: 'Bienvenido'
  fr: Bienvenue à tous
cta-main:
  en: "Start now"
  es: Empezar
`);

    expect(result.localizationStrings).toEqual({
      welcome: {
        en: "Welcome",
        es: "Bienvenido",
        fr: "Bienvenue à tous",
      },
      "cta-main": {
        en: "Start now",
        es: "Empezar",
      },
    });
  });

  it("merges multiple strings blocks, with later duplicate translations winning", () => {
    const result = parseMarkdownFull(`!strings
welcome:
  en: "Hello"
  es: "Hola"

!scene
!text i18n:welcome

---

!strings
welcome:
  es: "Hola actualizada"
cta:
  en: "Go"
`);

    expect(result.localizationStrings).toEqual({
      welcome: {
        en: "Hello",
        es: "Hola actualizada",
      },
      cta: { en: "Go" },
    });
  });

  it("requires indentation to be detected before trimming", () => {
    const result = parseMarkdownFull(`!strings
 welcome:
  en: "ignored because the key line was indented"
good:
\tes: "Bien"
  en: "Good"
`);

    expect(result.localizationStrings).toEqual({
      good: { es: "Bien", en: "Good" },
    });
  });

  it("stays lenient for malformed lines while preserving well-formed entries", () => {
    const result = parseMarkdownFull(`!strings
welcome: en: "inline values are malformed"
  es: "orphaned by the malformed key"
good:
  en: "Good"
  bad,locale: ignored
  malformed line
  es: "Bien"
`);

    expect(result.localizationStrings).toEqual({
      good: {
        en: "Good",
        es: "Bien",
      },
    });
  });

  it("parses localization blocks with CRLF line endings", () => {
    const result = parseMarkdownFull(
      '!locales en es\r\n!strings\r\nwelcome:\r\n  en: "Welcome"\r\n  es: "Bienvenido"\r\n---\r\n!scene\r\n!text i18n:welcome\r\n'
    );

    expect(result.locales).toEqual(["en", "es"]);
    expect(result.localizationStrings.welcome).toEqual({
      en: "Welcome",
      es: "Bienvenido",
    });
    expect(result.scenes).toHaveLength(1);
  });

  it("parses scene locale overrides and ignores document-level !locale", () => {
    const result = parseMarkdownFull(`!locale fr
!locales en es
!scene
!locale es
!text i18n:welcome
`);

    expect(result.locales).toEqual(["en", "es"]);
    expect(result.defaultLocale).toBe("en");
    expect(result.scenes[0].locale).toBe("es");
  });

  it("supports hyphenated keys in text shorthand and block properties", () => {
    const result = parseMarkdownFull(`!scene
!text i18n:welcome-home
Inline fallback

---

!scene
!text
Inline fallback
i18nKey: welcome-home
`);

    expect(result.scenes[0].text?.i18nKey).toBe("welcome-home");
    expect(result.scenes[0].text?.content).toBe("Inline fallback");
    expect(result.scenes[1].text?.i18nKey).toBe("welcome-home");
    expect(result.scenes[1].text?.content).toBe("Inline fallback");
  });

  it("parses mockup i18n keys even without inline mockup text", () => {
    const result = parseMarkdownFull(`!scene
!mockup device:iphone i18nKey:welcome
`);

    expect(result.scenes[0].mockup?.content.text).toMatchObject({
      content: "",
      i18nKey: "welcome",
    });
  });

  it("substitutes document variables in translation values", () => {
    const result = parseMarkdownFull(`!var brand Acme
!strings
welcome:
  en: "Welcome to $brand"
`);

    expect(result.localizationStrings.welcome.en).toBe("Welcome to Acme");
  });
});
