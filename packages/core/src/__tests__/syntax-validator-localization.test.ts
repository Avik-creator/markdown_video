import { describe, expect, it } from "vitest";
import { validateMarkdownSyntax } from "../validation";

const messages = (items: { message: string }[]) => items.map((item) => item.message);

const validLocalizedDocument = `!locales en es fr
!strings
welcome:
  en: "Welcome"
  es: "Bienvenido"
  fr: "Bienvenue"

---

!scene
!text i18n:welcome

---

!scene
!locale es
!text i18n:welcome
`;

describe("localization validation", () => {
  it("accepts a complete localized document without warnings", () => {
    const result = validateMarkdownSyntax(validLocalizedDocument);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("requires at least one locale token in !locales", () => {
    const result = validateMarkdownSyntax("!locales\n!scene\n!text\nHi\n");

    expect(result.valid).toBe(false);
    expect(messages(result.errors)).toContain("!locales requires at least one locale token");
    expect(result.errors.find((error) => error.message.includes("!locales"))?.line).toBe(1);
  });

  it("errors for malformed locale tokens", () => {
    const result = validateMarkdownSyntax("!locales en bad,locale\n!scene\n!locale bad,locale\n");

    expect(messages(result.errors)).toContain('Invalid locale token "bad,locale" in !locales');
    expect(messages(result.errors)).toContain('Invalid locale token "bad,locale" in !locale');
  });

  it("errors for malformed strings key and translation lines", () => {
    const result = validateMarkdownSyntax(`!locales en
!strings
welcome: en: "inline values are malformed"
  en: "orphaned"
good:
  malformed translation
`);

    expect(result.valid).toBe(false);
    expect(messages(result.errors)).toContain(
      "Malformed !strings key line; expected an unindented `key:` line with no inline value"
    );
    expect(messages(result.errors)).toContain(
      "!strings translation line has no preceding unindented string key"
    );
    expect(messages(result.errors)).toContain(
      "Malformed !strings translation line; expected an indented `locale: value` line"
    );
  });

  it("errors for unclosed quoted translation values", () => {
    const result = validateMarkdownSyntax(`!locales en
!strings
welcome:
  en: "Welcome
`);

    expect(messages(result.errors)).toContain(
      'Unclosed quote in !strings translation for "welcome" (en)'
    );
  });

  it("warns when a strings key has no translations", () => {
    const result = validateMarkdownSyntax(`!locales en
!strings
welcome:
`);

    expect(result.errors).toEqual([]);
    expect(messages(result.warnings)).toContain('String key "welcome" has no translation lines');
  });

  it("warns rather than errors when a translation locale is undeclared", () => {
    const result = validateMarkdownSyntax(`!locales en
!strings
welcome:
  en: "Welcome"
  es: "Bienvenido"
`);

    expect(result.errors).toEqual([]);
    expect(messages(result.warnings)).toContain('Translation locale "es" is not declared in !locales');
    expect(result.valid).toBe(true);
  });

  it("warns when an i18n reference has no strings entry", () => {
    const result = validateMarkdownSyntax(`!locales en
!scene
!text i18n:missing-key
`);

    expect(result.errors).toEqual([]);
    expect(messages(result.warnings)).toContain(
      'Localization key "missing-key" is referenced but no !strings entry defines it'
    );
  });

  it("substitutes variables before validating locale directives", () => {
    const result = validateMarkdownSyntax(`!var primary es
!locales en $primary
!scene
!locale $primary
!text i18n:missing
`);

    expect(messages(result.errors)).not.toContain('Invalid locale token "$primary" in !locales');
    expect(messages(result.errors)).not.toContain('Invalid locale token "$primary" in !locale');
    expect(messages(result.warnings)).not.toContain('Locale "$primary" is not declared in !locales');
  });

  it("warns when a scene locale is not declared", () => {
    const result = validateMarkdownSyntax(`!locales en es
!scene
!locale fr
!text i18n:welcome
`);

    expect(messages(result.warnings)).toContain('Locale "fr" is not declared in !locales');
    expect(result.valid).toBe(true);
  });

  it("warns that document-level !locale is ignored", () => {
    const result = validateMarkdownSyntax(`!locales en es
!locale es
!scene
!text
Hi
`);

    expect(messages(result.warnings)).toContain(
      "!locale outside a scene is ignored; it is a scene-level override"
    );
  });

  it("warns that !locales and !strings inside scenes are ignored", () => {
    const result = validateMarkdownSyntax(`!scene
!locales en es
!strings
welcome:
  en: "Welcome"
!text
Hi
`);

    expect(messages(result.warnings)).toContain(
      "!locales is document-level metadata and is ignored inside a scene"
    );
    expect(messages(result.warnings)).toContain(
      "!strings is document-level metadata and is ignored inside a scene"
    );
  });

  it("collects undefined key references from mockup text content", () => {
    const result = validateMarkdownSyntax(`!locales en
!scene
!mockup device:iphone i18nKey:missing
`);

    expect(messages(result.warnings)).toContain(
      'Localization key "missing" is referenced but no !strings entry defines it'
    );
  });
});
