// Localization parsing and resolution helpers.
//
// Locale and key tokens are deliberately small, URL/JSON-friendly words:
// ASCII letters, digits and underscores, with single hyphens allowed between
// those segments (`en`, `pt-BR`, `welcome_1`, `welcome-title`). Matching is
// exact and case-sensitive; lowercase BCP-47-style locale codes are the
// documented convention. The parser is lenient and ignores malformed tokens,
// while the validator reports them to the author.

import type {
  LocalizationStrings,
  SceneText,
  VideoVariables,
} from "../types.js";
import { DELIMITERS } from "./constants.js";
import { substituteVariables } from "./utils.js";

export const LOCALIZATION_TOKEN_PATTERN =
  /^[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*$/;

export function isLocalizationToken(token: string): boolean {
  return LOCALIZATION_TOKEN_PATTERN.test(token);
}

/** Strip one matching pair of single or double quotes. Quotes are optional. */
export function stripLocalizationQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' || first === "'") && last === first) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

export interface ParsedLocalizationStringsBlock {
  localizationStrings: LocalizationStrings;
  /** Index of the first line after the block (a directive, separator, or EOF). */
  endIndex: number;
}

/**
 * Parse the body of a `!strings` directive.
 *
 * Grammar (indentation is significant and therefore inspected before any
 * trimming):
 *
 * - a key line is an unindented `key:` line with no inline value;
 * - a translation line is indented at least one space/tab and has the form
 *   `locale: value`;
 * - translation values may be unquoted, single-quoted, or double-quoted; one
 *   matching pair of surrounding quotes is stripped;
 * - blank lines are ignored;
 * - the block ends at the next directive or scene separator;
 * - malformed lines are ignored here and reported by the validator.
 *
 * Repeated keys and repeated `!strings` blocks merge. When the same locale is
 * defined twice for a key, the later definition in document order wins.
 */
export function parseLocalizationStringsBlock(
  lines: readonly string[],
  startIndex: number,
  variables: VideoVariables = {}
): ParsedLocalizationStringsBlock {
  const localizationStrings: LocalizationStrings = {};
  let currentKey: string | null = null;
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (
      trimmed.startsWith(DELIMITERS.DIRECTIVE_PREFIX) ||
      trimmed === DELIMITERS.SCENE_SEPARATOR
    ) {
      break;
    }

    if (!trimmed) {
      index++;
      continue;
    }

    const indentation = rawLine.match(/^[ \t]*/)?.[0] ?? "";
    const isIndented = indentation.length > 0;

    if (!isIndented) {
      const keyMatch = trimmed.match(/^([^\s:]+)\s*:\s*$/);
      if (keyMatch && isLocalizationToken(keyMatch[1])) {
        currentKey = keyMatch[1];
        if (!localizationStrings[currentKey]) {
          localizationStrings[currentKey] = {};
        }
      } else {
        // Do not let translations after a malformed key attach to the
        // previous well-formed key.
        currentKey = null;
      }
      index++;
      continue;
    }

    const translationMatch = trimmed.match(/^([^\s:]+)\s*:\s*(.*)$/);
    if (currentKey && translationMatch && isLocalizationToken(translationMatch[1])) {
      const locale = translationMatch[1];
      const unquotedValue = stripLocalizationQuotes(translationMatch[2]);
      const value = substituteVariables(unquotedValue, variables);
      localizationStrings[currentKey] = {
        ...localizationStrings[currentKey],
        [locale]: value,
      };
    }

    index++;
  }

  return { localizationStrings, endIndex: index };
}

export function mergeLocalizationStrings(
  target: LocalizationStrings,
  source: LocalizationStrings
): LocalizationStrings {
  for (const [key, translations] of Object.entries(source)) {
    target[key] = {
      ...(target[key] ?? {}),
      ...translations,
    };
  }
  return target;
}

export interface EffectiveLocaleInput {
  /** Scene-level `!locale` override. This always wins when present. */
  sceneLocale?: string;
  /** User-selected locale. It is used only when declared by the document. */
  activeLocale?: string | null;
  /** Document-declared locales from `!locales`. */
  locales?: readonly string[];
  /** Document default locale (the first valid token in `!locales`). */
  defaultLocale?: string;
}

/**
 * Resolve the locale used for one scene's lookups:
 *
 * 1. `sceneLocale` (`!locale` inside the scene);
 * 2. `activeLocale`, but only when it is one of the declared `locales`;
 * 3. `defaultLocale`;
 * 4. the first declared locale;
 * 5. `undefined` for monolingual documents.
 */
export function resolveEffectiveLocale({
  sceneLocale,
  activeLocale,
  locales = [],
  defaultLocale,
}: EffectiveLocaleInput): string | undefined {
  if (sceneLocale) return sceneLocale;
  if (activeLocale && locales.includes(activeLocale)) return activeLocale;
  return defaultLocale ?? locales[0];
}

export interface LocalizedStringInput {
  strings?: LocalizationStrings;
  key: string;
  /** Effective locale after applying scene/document/user precedence. */
  locale?: string;
  /** Document default locale used as the first cross-locale fallback. */
  defaultLocale?: string;
  /** Inline text authored beside the i18n key, if any. */
  inlineContent?: string;
}

function hasTranslation(
  translations: Record<string, string>,
  locale: string
): boolean {
  return Object.prototype.hasOwnProperty.call(translations, locale);
}

/**
 * Resolve an i18n key deterministically. The fallback chain is:
 *
 * 1. the translation for the effective locale;
 * 2. the translation for the document default locale;
 * 3. the first translation defined for the key (object insertion order);
 * 4. non-empty inline content authored beside the i18n key;
 * 5. the literal key, making missing translations visible and debuggable.
 *
 * Translation presence is determined with hasOwnProperty, so an intentionally
 * empty authored translation is respected rather than treated as missing.
 */
export function resolveLocalizedString({
  strings,
  key,
  locale,
  defaultLocale,
  inlineContent,
}: LocalizedStringInput): string {
  const translations = strings?.[key];

  if (translations) {
    if (locale && hasTranslation(translations, locale)) {
      return translations[locale];
    }
    if (defaultLocale && hasTranslation(translations, defaultLocale)) {
      return translations[defaultLocale];
    }

    const firstLocale = Object.keys(translations)[0];
    if (firstLocale !== undefined) {
      return translations[firstLocale];
    }
  }

  if (inlineContent !== undefined && inlineContent.trim() !== "") {
    return inlineContent;
  }

  return key;
}

export interface SceneTextResolutionContext {
  strings?: LocalizationStrings;
  locale?: string;
  defaultLocale?: string;
}

/** Resolve `SceneText`, applying the i18n chain only when `i18nKey` exists. */
export function resolveSceneTextContent(
  text: SceneText,
  { strings, locale, defaultLocale }: SceneTextResolutionContext
): string {
  if (!text.i18nKey) return text.content;
  return resolveLocalizedString({
    strings,
    key: text.i18nKey,
    locale,
    defaultLocale,
    inlineContent: text.content,
  });
}
