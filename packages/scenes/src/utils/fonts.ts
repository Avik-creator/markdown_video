import type {
  CodeFontFamily,
  TextFontFamily,
} from "@markdown-video/core";

export interface FontFamilyStyle {
  fontFamily: string;
}

const MONOSPACE_FALLBACKS = "ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * The host font-loading contract, in one authoritative place.
 *
 * Scene font families resolve through CSS custom properties that the HOST
 * must define — the package never loads fonts itself. The Next.js editor
 * defines them with next/font in app/layout.tsx (which exposes hashed family
 * names through exactly these variables); a headless render host can define
 * the same variable names with @font-face rules and its own font files.
 *
 * The variable names intentionally do not use Google family names: hosts
 * injecting next/font cannot choose them, so the contract is fixed.
 */
export const SCENE_TEXT_FONT_VARIABLES: Record<TextFontFamily, string> = {
  serif: "--font-playfair",
  sans: "--font-inter",
  mono: "--font-ibm-plex-family",
  display: "--font-merriweather-family",
};

export const SCENE_CODE_FONT_VARIABLES: Record<
  Exclude<CodeFontFamily, "courier">,
  string
> = {
  mono: "--font-geist-mono",
  jetbrains: "--font-jetbrains-family",
  fira: "--font-fira-family",
  source: "--font-source-code-family",
  inconsolata: "--font-inconsolata-family",
};

/**
 * CSS variable carrying the host's color-emoji family chain.
 *
 * This is a separate variable because text hosts expose their primary font as
 * one token stream: there is no CSS-only way to splice a family into the middle
 * of var(--font-inter). Scene chains therefore place the emoji variable directly
 * after the primary text family. Primary ordering keeps ASCII digits and other
 * text-presentation characters in the text font; the emoji face's unicode-range
 * then confines this fallback slot to emoji-related codepoints instead of making
 * it a general-purpose font.
 */
export const SCENE_EMOJI_FONT_VARIABLE = "--font-emoji";

/** Every CSS variable a host must define for full scene font coverage. */
export const SCENE_FONT_CSS_VARIABLES: readonly string[] = [
  ...Object.values(SCENE_TEXT_FONT_VARIABLES),
  ...Object.values(SCENE_CODE_FONT_VARIABLES),
  SCENE_EMOJI_FONT_VARIABLE,
];

/**
 * Build a font-family declaration around a host-provided CSS variable.
 *
 * The fallback argument inside var() is deliberate. If a custom property is
 * unavailable (most importantly in a detached html2canvas clone whose styles
 * failed to copy), the declaration still resolves to the fallback instead of
 * becoming invalid at computed-value time. In normal rendering and in intact
 * export clones, the variable contains the host's generated family names.
 */
function variableFontFamily(
  variableName: string,
  fallbacks: string
): string {
  const firstFallback = fallbacks.split(",")[0].trim();
  return `var(${variableName}, ${firstFallback}), var(${SCENE_EMOJI_FONT_VARIABLE}, ${firstFallback}), ${fallbacks}`;
}

const SERIF_FALLBACKS = "Georgia, serif";
const SANS_FALLBACKS = "system-ui, sans-serif";

const TEXT_FALLBACKS: Record<TextFontFamily, string> = {
  serif: SERIF_FALLBACKS,
  sans: SANS_FALLBACKS,
  mono: MONOSPACE_FALLBACKS,
  display: SERIF_FALLBACKS,
};

function buildFontStyles<T extends string>(
  variables: Record<T, string>,
  fallbacks: Record<T, string>
): Record<T, FontFamilyStyle> {
  const styles = {} as Record<T, FontFamilyStyle>;
  for (const key of Object.keys(variables) as T[]) {
    styles[key] = {
      fontFamily: variableFontFamily(variables[key], fallbacks[key]),
    };
  }
  return styles;
}

export const textFontFamilyStyles: Record<TextFontFamily, FontFamilyStyle> =
  buildFontStyles(SCENE_TEXT_FONT_VARIABLES, TEXT_FALLBACKS);

const CODE_FALLBACKS: Record<keyof typeof SCENE_CODE_FONT_VARIABLES, string> = {
  mono: MONOSPACE_FALLBACKS,
  jetbrains: MONOSPACE_FALLBACKS,
  fira: MONOSPACE_FALLBACKS,
  source: MONOSPACE_FALLBACKS,
  inconsolata: MONOSPACE_FALLBACKS,
};

export const codeFontFamilyStyles: Record<CodeFontFamily, FontFamilyStyle> = {
  ...buildFontStyles(SCENE_CODE_FONT_VARIABLES, CODE_FALLBACKS),
  // Courier is a system font; there is no corresponding primary host variable,
  // but emoji in courier text still use the host's emoji family.
  courier: {
    fontFamily: `"Courier New", var(${SCENE_EMOJI_FONT_VARIABLE}, Courier), Courier, monospace`,
  },
};
