import type {
  CodeFontFamily,
  TextFontFamily,
} from "@markdown-video/core";

export interface FontFamilyStyle {
  fontFamily: string;
}

const MONOSPACE_FALLBACKS = "ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * Build a font-family declaration around a next/font CSS variable.
 *
 * The fallback argument inside var() is deliberate. If a custom property is
 * unavailable (most importantly in a detached html2canvas clone whose styles
 * failed to copy), the declaration still resolves to the fallback instead of
 * becoming invalid at computed-value time. In normal rendering and in intact
 * export clones, the variable contains next/font's generated family names.
 */
function variableFontFamily(
  variableName: string,
  fallbacks: string
): string {
  const firstFallback = fallbacks.split(",")[0].trim();
  return `var(${variableName}, ${firstFallback}), ${fallbacks}`;
}

/**
 * Variables must match app/layout.tsx. They intentionally do not use Google
 * family names: next/font exposes hashed family names through these variables.
 */
export const textFontFamilyStyles: Record<TextFontFamily, FontFamilyStyle> = {
  serif: {
    fontFamily: variableFontFamily("--font-playfair", "Georgia, serif"),
  },
  sans: {
    fontFamily: variableFontFamily("--font-inter", "system-ui, sans-serif"),
  },
  mono: {
    fontFamily: variableFontFamily(
      "--font-ibm-plex-family",
      MONOSPACE_FALLBACKS
    ),
  },
  display: {
    fontFamily: variableFontFamily(
      "--font-merriweather-family",
      "Georgia, serif"
    ),
  },
};

export const codeFontFamilyStyles: Record<CodeFontFamily, FontFamilyStyle> = {
  mono: {
    fontFamily: variableFontFamily("--font-geist-mono", MONOSPACE_FALLBACKS),
  },
  jetbrains: {
    fontFamily: variableFontFamily(
      "--font-jetbrains-family",
      MONOSPACE_FALLBACKS
    ),
  },
  fira: {
    fontFamily: variableFontFamily("--font-fira-family", MONOSPACE_FALLBACKS),
  },
  source: {
    fontFamily: variableFontFamily(
      "--font-source-code-family",
      MONOSPACE_FALLBACKS
    ),
  },
  inconsolata: {
    fontFamily: variableFontFamily(
      "--font-inconsolata-family",
      MONOSPACE_FALLBACKS
    ),
  },
  // Courier is a system font; there is no corresponding next/font variable.
  courier: { fontFamily: '"Courier New", Courier, monospace' },
};
