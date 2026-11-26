import { describe, expect, it } from "vitest";
import {
  codeFontFamilyStyles,
  textFontFamilyStyles,
} from "../fonts.js";

describe("scene font family styles", () => {
  it("maps text fonts to the next/font CSS variables exposed by the root layout", () => {
    expect(textFontFamilyStyles.serif.fontFamily).toBe(
      "var(--font-playfair, Georgia), Georgia, serif"
    );
    expect(textFontFamilyStyles.sans.fontFamily).toBe(
      "var(--font-inter, system-ui), system-ui, sans-serif"
    );
    expect(textFontFamilyStyles.mono.fontFamily).toBe(
      "var(--font-ibm-plex-family, ui-monospace), ui-monospace, SFMono-Regular, Menlo, monospace"
    );
    expect(textFontFamilyStyles.display.fontFamily).toBe(
      "var(--font-merriweather-family, Georgia), Georgia, serif"
    );
  });

  it("maps code fonts to the next/font CSS variables exposed by the root layout", () => {
    expect(codeFontFamilyStyles.mono.fontFamily).toBe(
      "var(--font-geist-mono, ui-monospace), ui-monospace, SFMono-Regular, Menlo, monospace"
    );
    expect(codeFontFamilyStyles.jetbrains.fontFamily).toBe(
      "var(--font-jetbrains-family, ui-monospace), ui-monospace, SFMono-Regular, Menlo, monospace"
    );
    expect(codeFontFamilyStyles.fira.fontFamily).toBe(
      "var(--font-fira-family, ui-monospace), ui-monospace, SFMono-Regular, Menlo, monospace"
    );
    expect(codeFontFamilyStyles.source.fontFamily).toBe(
      "var(--font-source-code-family, ui-monospace), ui-monospace, SFMono-Regular, Menlo, monospace"
    );
    expect(codeFontFamilyStyles.inconsolata.fontFamily).toBe(
      "var(--font-inconsolata-family, ui-monospace), ui-monospace, SFMono-Regular, Menlo, monospace"
    );
  });

  it("keeps Courier as a system font because no Courier next/font variable exists", () => {
    expect(codeFontFamilyStyles.courier.fontFamily).toBe(
      '"Courier New", Courier, monospace'
    );
  });

  it("uses fallback arguments inside var() so missing variables cannot invalidate the whole declaration", () => {
    for (const style of [
      ...Object.values(textFontFamilyStyles),
      ...Object.values(codeFontFamilyStyles),
    ]) {
      if (!style.fontFamily.startsWith("var(")) continue;
      expect(style.fontFamily).toMatch(/^var\(--font-[^,]+, [^)]+\), /);
    }
  });

  it("does not depend on hard-coded Google font family names", () => {
    const values = [
      ...Object.values(textFontFamilyStyles),
      ...Object.values(codeFontFamilyStyles),
    ].map((style) => style.fontFamily);

    for (const value of values) {
      expect(value).not.toMatch(
        /Playfair Display|Source Code Pro|IBM Plex Mono|JetBrains Mono|Fira Code|Inconsolata|Merriweather/
      );
    }
  });
});
