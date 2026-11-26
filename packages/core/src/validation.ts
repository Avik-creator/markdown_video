// Syntax validation utilities for markdown_video
import { parseMarkdownFull } from "./parser/index.js";
import { isLocalizationToken } from "./parser/i18n.js";
import type { LocalizationStrings, Scene, VideoVariables } from "./types.js";
import {
  SCENE_DIRECTIVES,
  ANIMATION_TYPES,
  TRANSITION_TYPES,
  TEXT_FONT_FAMILIES,
  TEXT_SIZES,
  CODE_FONT_FAMILIES,
  CODE_FONT_SIZES,
  PARTICLE_TYPES,
  PARTICLE_INTENSITIES,
  DEVICE_TYPES,
  CHART_TYPES,
  CAMERA_EFFECTS,
  PRESENTER_POSITIONS,
  PRESENTER_SIZES,
  PRESENTER_SHAPES,
  EMOJI_ANIMATIONS,
  COUNTDOWN_STYLES,
  PROGRESS_STYLES,
  CALLOUT_ARROWS,
  CALLOUT_STYLES,
  IMAGE_FIT_OPTIONS,
  IMAGE_POSITIONS,
  DIRECTIVE_CASES,
  KEYWORD_ALIASES,
} from "./parser/constants.js";
import {
  assertNever,
  getCameraKeyframeProperty,
  getDirectivePositional,
  getDirectiveProperty,
  getDirectiveSchema,
  isOneOf,
  isOneOfCaseInsensitive,
  type AnyDirectiveSchema,
  type CanonicalDirectiveName,
  type DirectiveValueSchema,
} from "./directive-schema.js";
import {
  classifyDirectivePropertyLine,
  parseInlineArguments,
  type InlineToken,
} from "./parser/parsers/schema-values.js";
import {
  collectVariableDefinitions,
  parseDirective,
  substituteVariables,
} from "./parser/utils.js";

export interface ValidationError {
  line?: number;
  message: string;
  severity: "error" | "warning" | "info";
  suggestion?: string;
  /** A one-click fix: replace `find` with `replace` on `line`. */
  fix?: { find: string; replace: string };
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  scenes: Scene[];
  totalDuration: number;
}

/**
 * Validates markdown syntax for video creation
 */
export function validateMarkdownSyntax(markdown: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const lines = markdown.split(/\r?\n/);

  try {
    // Parse the markdown
    const result = parseMarkdownFull(markdown);
    const {
      scenes,
      variables,
      locales,
      localizationStrings,
    } = result;

    validateLocalization(lines, variables, locales, localizationStrings, scenes, errors, warnings);

    // Validate scenes
    if (scenes.length === 0) {
      warnings.push({
        message: "No scenes found. Add a scene using !scene, !slide, or !frame",
        severity: "warning",
        suggestion: "Start with: !scene\\n!text\\nYour content here",
      });
    }

    // Validate each scene
    scenes.forEach((scene, index) => {
      validateScene(scene, index, errors, warnings, sceneLineFinder(scene, lines));
    });

    // Validate directives, skipping fenced code where "!" means nothing
    let fenceStart: number | null = null;
    lines.forEach((line, lineNumber) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        fenceStart = fenceStart === null ? lineNumber + 1 : null;
        return;
      }
      if (fenceStart === null && trimmed.startsWith("!")) {
        validateDirective(trimmed, lineNumber + 1, errors, warnings);
      }
    });

    // Validate schema-backed values directly from the source. This catches
    // invalid input that the parser currently coerces to a default (for
    // example font families, emoji sizes, countdown styles and callout styles).
    validateSchemaBackedValues(lines, errors, warnings);

    if (fenceStart !== null) {
      errors.push({
        line: fenceStart,
        message: "Unclosed code block",
        severity: "error",
        suggestion: "Close the block with a line containing ```",
      });
    }

    // Calculate total duration
    const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);

    validateMusicDirectives(lines, totalDuration, errors, warnings);

    // Check for excessively long videos
    if (totalDuration > 600) {
      warnings.push({
        message: `Video duration is very long (${totalDuration}s). Consider breaking it into smaller segments.`,
        severity: "warning",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      scenes,
      totalDuration,
    };
  } catch (error) {
    errors.push({
      message: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
      severity: "error",
    });

    return {
      valid: false,
      errors,
      warnings,
      scenes: [],
      totalDuration: 0,
    };
  }
}


function validateMusicDirectives(
  lines: string[],
  totalDuration: number,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  const variables = collectVariableDefinitions(lines);
  let insideScene = false;
  let inFence = false;
  let seenDocumentMusic = false;

  lines.forEach((sourceLine, index) => {
    const lineNumber = index + 1;
    const line = substituteVariables(sourceLine.trim(), variables);

    if (line.startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    if (line === "---") {
      insideScene = false;
      return;
    }

    const directive = parseDirective(line);
    if (!directive) return;

    const schema = getDirectiveSchema(directive.name);
    if (!schema) return;
    if (schema.name === "scene") {
      insideScene = true;
      return;
    }
    if (schema.name !== "music") return;

    if (insideScene) {
      warnings.push({
        line: lineNumber,
        message: "!music is document-level metadata and is ignored inside a scene",
        severity: "warning",
        suggestion: "Move it before the first scene or after a scene separator",
      });
      return;
    }

    if (seenDocumentMusic) {
      warnings.push({
        line: lineNumber,
        message: "Only one music track is supported; this later !music replaces the earlier one",
        severity: "warning",
      });
    }
    seenDocumentMusic = true;

    const { tokens, positional } = parseInlineArguments(directive.args);
    const src = positional[0];
    if (!src) {
      errors.push({
        line: lineNumber,
        message: "!music requires an HTTPS URL or audio file path as its first argument",
        severity: "error",
        suggestion: "Use: !music https://example.com/theme.mp3 volume:0.4 fade:1s",
      });
      return;
    }

    if (positional.length > 1) {
      warnings.push({
        line: lineNumber,
        message: `Extra positional music argument "${positional[1]}" is ignored`,
        severity: "warning",
        suggestion: "Put options in key:value form, for example volume:0.4 fade:1s loop:false",
      });
    }

    for (const token of tokens) {
      if (token.key && !getDirectiveProperty("music", token.key)) {
        warnings.push({
          line: lineNumber,
          message: `Unknown !music option "${token.key}" is ignored`,
          severity: "warning",
          suggestion: "Valid options: volume, fade, loop",
        });
      }
    }

    if (/^http:\/\//i.test(src) || src.startsWith("//")) {
      errors.push({
        line: lineNumber,
        message: "Remote music must use HTTPS",
        severity: "error",
        suggestion: `Use https: instead of http: in "${src}"`,
      });
      return;
    }

    if (/^https:\/\//i.test(src)) {
      try {
        const url = new URL(src);
        if (url.username || url.password) {
          errors.push({
            line: lineNumber,
            message: "Music URLs must not embed credentials",
            severity: "error",
            suggestion: "Remove the username/password and use a CORS-accessible HTTPS URL",
          });
        }
      } catch {
        errors.push({
          line: lineNumber,
          message: `Invalid music URL "${src}"`,
          severity: "error",
        });
      }
      return;
    }

    if (/^(data|blob):/i.test(src)) return;

    // Other URI schemes are not portable renderer inputs. Single-letter
    // Windows drive prefixes are treated as local paths rather than schemes;
    // quote such paths when they contain spaces.
    const scheme = src.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
    if (scheme && scheme[1].length > 1) {
      errors.push({
        line: lineNumber,
        message: `Unsupported music source scheme "${scheme[1]}:"`,
        severity: "error",
        suggestion: "Use an HTTPS URL, data/blob URL, or local/relative audio file path",
      });
    }

    const fadeToken = tokens.find((token) => token.key?.toLowerCase() === "fade");
    if (fadeToken?.value) {
      const rawFade = fadeToken.value.replace(/s$/i, "");
      const fade = Number.parseFloat(rawFade);
      if (
        Number.isFinite(fade) &&
        fade >= 0 &&
        fade <= 30 &&
        totalDuration > 0 &&
        fade > totalDuration / 2
      ) {
        warnings.push({
          line: lineNumber,
          message: `Music fade (${fade}s) exceeds half the video duration (${totalDuration}s); renderers clamp the effective fade`,
          severity: "warning",
        });
      }
    }
  });
}

// ============================================
// Localization validation
// ============================================

function validateLocalesDirective(
  args: string,
  lineNumber: number,
  insideScene: boolean,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  if (insideScene) {
    warnings.push({
      line: lineNumber,
      message: "!locales is document-level metadata and is ignored inside a scene",
      severity: "warning",
      suggestion: "Move it before the first scene or after a scene separator",
    });
  }

  const { tokens, positional } = parseInlineArguments(args);
  const positionalTokens = tokens.filter((token) => token.key === undefined);
  let validLocaleCount = 0;

  for (const token of tokens) {
    if (token.key !== undefined) {
      errors.push({
        line: lineNumber,
        message: `Invalid locale token "${token.raw}" in !locales`,
        severity: "error",
        suggestion: "Use whitespace-separated locale codes such as: !locales en es fr",
      });
      continue;
    }

    const positionalIndex = positionalTokens.indexOf(token);
    const locale = positional[positionalIndex] ?? token.raw;
    if (!isLocalizationToken(locale)) {
      errors.push({
        line: lineNumber,
        message: `Invalid locale token "${locale}" in !locales`,
        severity: "error",
        suggestion: "Use letters, digits, underscores, and hyphens (for example en or pt-BR)",
      });
    } else {
      validLocaleCount++;
    }
  }

  if (validLocaleCount === 0) {
    errors.push({
      line: lineNumber,
      message: "!locales requires at least one locale token",
      severity: "error",
      suggestion: "Use whitespace-separated locale codes such as: !locales en es fr",
    });
  }
}

function validateLocaleDirective(
  args: string,
  lineNumber: number,
  insideScene: boolean,
  declaredLocales: readonly string[],
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  const { positional } = parseInlineArguments(args);
  const locale = positional[0];

  if (!insideScene) {
    warnings.push({
      line: lineNumber,
      message: "!locale outside a scene is ignored; it is a scene-level override",
      severity: "warning",
      suggestion: "Place !locale inside a scene, or use !locales to choose the document default",
    });
  }

  if (!locale) {
    errors.push({
      line: lineNumber,
      message: "!locale requires a locale code",
      severity: "error",
    });
    return;
  }

  if (!isLocalizationToken(locale)) {
    errors.push({
      line: lineNumber,
      message: `Invalid locale token "${locale}" in !locale`,
      severity: "error",
      suggestion: "Use letters, digits, underscores, and hyphens (for example en or pt-BR)",
    });
    return;
  }

  if (!declaredLocales.includes(locale)) {
    warnings.push({
      line: lineNumber,
      message: `Locale "${locale}" is not declared in !locales`,
      severity: "warning",
      suggestion: declaredLocales.length > 0
        ? `Declared locales: ${declaredLocales.join(", ")}`
        : "Declare locales at document level, for example: !locales en es fr",
    });
  }
}

interface StringsKeyState {
  name: string;
  line: number;
  translationCount: number;
}

function hasUnclosedQuotedValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  const first = trimmed[0];
  if (first !== '"' && first !== "'") return false;
  return trimmed.length < 2 || trimmed[trimmed.length - 1] !== first;
}

/**
 * Validate the indentation-sensitive `!strings` grammar from raw source.
 * The parser intentionally stays lenient; malformed lines are errors here
 * because they are silently unavailable at render time otherwise. Missing or
 * partial translations are warnings because partial localization documents
 * are legitimate while in progress.
 *
 * Returns the first line index after the block.
 */
function validateStringsBlock(
  lines: readonly string[],
  startIndex: number,
  declaredLocales: readonly string[],
  errors: ValidationError[],
  warnings: ValidationError[]
): number {
  let currentKey: StringsKeyState | null = null;
  let index = startIndex;

  const finishCurrentKey = () => {
    if (currentKey && currentKey.translationCount === 0) {
      warnings.push({
        line: currentKey.line,
        message: `String key "${currentKey.name}" has no translation lines`,
        severity: "warning",
        suggestion: `Add indented translations, for example:  en: "Text"`,
      });
    }
  };

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    const lineNumber = index + 1;

    if (trimmed.startsWith("!") || trimmed === "---") {
      break;
    }

    if (!trimmed) {
      index++;
      continue;
    }

    const indentation = rawLine.match(/^[ \t]*/)?.[0] ?? "";
    const isIndented = indentation.length > 0;

    if (!isIndented) {
      finishCurrentKey();
      const keyMatch = trimmed.match(/^([^\s:]+)\s*:\s*$/);
      if (keyMatch && isLocalizationToken(keyMatch[1])) {
        currentKey = {
          name: keyMatch[1],
          line: lineNumber,
          translationCount: 0,
        };
      } else {
        currentKey = null;
        errors.push({
          line: lineNumber,
          message: "Malformed !strings key line; expected an unindented `key:` line with no inline value",
          severity: "error",
        });
      }
      index++;
      continue;
    }

    const translationMatch = trimmed.match(/^([^\s:]+)\s*:\s*(.*)$/);
    if (!currentKey) {
      errors.push({
        line: lineNumber,
        message: "!strings translation line has no preceding unindented string key",
        severity: "error",
      });
    } else if (!translationMatch) {
      errors.push({
        line: lineNumber,
        message: "Malformed !strings translation line; expected an indented `locale: value` line",
        severity: "error",
      });
    } else if (!isLocalizationToken(translationMatch[1])) {
      errors.push({
        line: lineNumber,
        message: `Invalid locale token "${translationMatch[1]}" in !strings`,
        severity: "error",
        suggestion: "Use letters, digits, underscores, and hyphens (for example en or pt-BR)",
      });
    } else {
      currentKey.translationCount++;
      const locale = translationMatch[1];
      const value = translationMatch[2];

      if (hasUnclosedQuotedValue(value)) {
        errors.push({
          line: lineNumber,
          message: `Unclosed quote in !strings translation for "${currentKey.name}" (${locale})`,
          severity: "error",
        });
      }

      if (!declaredLocales.includes(locale)) {
        warnings.push({
          line: lineNumber,
          message: `Translation locale "${locale}" is not declared in !locales`,
          severity: "warning",
          suggestion: declaredLocales.length > 0
            ? `Declared locales: ${declaredLocales.join(", ")}`
            : "Declare locales at document level, for example: !locales en es fr",
        });
      }
    }

    index++;
  }

  finishCurrentKey();
  return index;
}

function collectI18nKeyReferences(value: unknown, keys: Set<string>): void {
  if (!value || typeof value !== "object") return;

  const sceneLike = value as {
    text?: { i18nKey?: string };
    mockup?: { content?: { text?: { i18nKey?: string } } };
    split?: { left?: unknown; right?: unknown };
  };

  if (sceneLike.text?.i18nKey) keys.add(sceneLike.text.i18nKey);
  if (sceneLike.mockup?.content?.text?.i18nKey) {
    keys.add(sceneLike.mockup.content.text.i18nKey);
  }
  if (sceneLike.split) {
    collectI18nKeyReferences(sceneLike.split.left, keys);
    collectI18nKeyReferences(sceneLike.split.right, keys);
  }
}

/**
 * Validate document/scene locale declarations, strings-block structure, and
 * key references. Locale consistency issues are warnings because partial
 * localization documents are valid works in progress; structurally malformed
 * lines are errors because the parser cannot use them.
 */
function validateLocalization(
  lines: readonly string[],
  variables: VideoVariables,
  declaredLocales: readonly string[],
  localizationStrings: LocalizationStrings,
  scenes: readonly Scene[],
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  let insideScene = false;
  let inFence = false;

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index];
    const line = substituteVariables(rawLine.trim(), variables);
    const lineNumber = index + 1;

    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (line === "---") {
      insideScene = false;
      continue;
    }

    const directive = parseDirective(line);
    if (!directive) continue;

    if (directive.canonicalName === "scene") {
      insideScene = true;
      continue;
    }

    if (directive.canonicalName === "locales") {
      validateLocalesDirective(
        directive.args,
        lineNumber,
        insideScene,
        errors,
        warnings
      );
      continue;
    }

    if (directive.canonicalName === "locale") {
      validateLocaleDirective(
        directive.args,
        lineNumber,
        insideScene,
        declaredLocales,
        errors,
        warnings
      );
      continue;
    }

    if (directive.canonicalName === "strings") {
      if (insideScene) {
        warnings.push({
          line: lineNumber,
          message: "!strings is document-level metadata and is ignored inside a scene",
          severity: "warning",
          suggestion: "Move it before the first scene or after a scene separator",
        });
        continue;
      }

      const endIndex = validateStringsBlock(
        lines,
        index + 1,
        declaredLocales,
        errors,
        warnings
      );
      // The loop increment moves us onto the terminating directive/separator
      // (or one past EOF), so process that terminator normally.
      index = endIndex - 1;
    }
  }

  const referencedKeys = new Set<string>();
  for (const scene of scenes) {
    collectI18nKeyReferences(scene, referencedKeys);
  }

  for (const key of Array.from(referencedKeys).sort()) {
    if (!Object.prototype.hasOwnProperty.call(localizationStrings, key)) {
      warnings.push({
        message: `Localization key "${key}" is referenced but no !strings entry defines it`,
        severity: "warning",
        suggestion: "Define the key in a document-level !strings block or remove the i18n reference",
      });
    }
  }
}

/**
 * Validates a single scene
 */
function validateScene(
  scene: Scene,
  index: number,
  errors: ValidationError[],
  warnings: ValidationError[],
  lineOf: (...patterns: RegExp[]) => number | undefined
): void {
  // Non-positive durations are reported by the schema-backed source
  // validation below. Keeping a second post-parse error here duplicates the
  // same source line (for example `!duration 0`).
  if (scene.duration > 60) {
    warnings.push({
      line: lineOf(/^!(duration|time|length|dur)\b/i),
      message: `Scene ${index + 1}: Very long duration (${scene.duration}s)`,
      severity: "warning",
      suggestion: "Consider breaking long scenes into smaller ones",
    });
  }

  // Validate transition
  if (scene.transition && !isOneOf(TRANSITION_TYPES, scene.transition)) {
    errors.push({
      line: lineOf(/^!(transition|trans|effect|animation)\b/i),
      message: `Scene ${index + 1}: Invalid transition "${scene.transition}"`,
      severity: "error",
      suggestion: `Valid transitions: ${TRANSITION_TYPES.join(", ")}`,
    });
  }

  // Validate text scene
  if (scene.type === "text" && scene.text) {
    if ((!scene.text.content || scene.text.content.trim() === "") && !scene.text.i18nKey) {
      warnings.push({
      line: lineOf(/^!(text|heading|title|h1|h2|h3|paragraph|p)\b/i),
        message: `Scene ${index + 1}: Text content is empty`,
        severity: "warning",
      });
    }

    if (scene.text.animation && !isOneOf(ANIMATION_TYPES, scene.text.animation)) {
      errors.push({
      line: lineOf(/^animation:/i, /^!(text|heading|title|h1|h2|h3|paragraph|p)\b/i),
        message: `Scene ${index + 1}: Invalid animation "${scene.text.animation}"`,
        severity: "error",
        suggestion: `Valid animations: ${ANIMATION_TYPES.join(", ")}`,
      });
    }

    if (scene.text.size && !isOneOf(TEXT_SIZES, scene.text.size)) {
      errors.push({
        line: lineOf(/^size:/i, /^!(text|heading|title|h1|h2|h3|paragraph|p)\b/i),
        message: `Scene ${index + 1}: Invalid text size "${scene.text.size}"`,
        severity: "error",
        suggestion: `Valid sizes: ${TEXT_SIZES.join(", ")}`,
      });
    }

    if (scene.text.fontFamily && !isOneOf(TEXT_FONT_FAMILIES, scene.text.fontFamily)) {
      errors.push({
      line: lineOf(/^(fontFamily|font):/i, /^!(text|heading|title|h1|h2|h3|paragraph|p)\b/i),
        message: `Scene ${index + 1}: Invalid font family "${scene.text.fontFamily}"`,
        severity: "error",
        suggestion: `Valid fonts: ${TEXT_FONT_FAMILIES.join(", ")}`,
      });
    }
  }

  // Validate code scene
  if (scene.type === "code" && scene.code) {
    if (!scene.code.content || scene.code.content.trim() === "") {
      warnings.push({
      line: lineOf(/^!(code|snippet|block|codeblock|syntax)\b/i),
        message: `Scene ${index + 1}: Code content is empty`,
        severity: "warning",
      });
    }

    if (scene.code.fontSize && !isOneOf(CODE_FONT_SIZES, scene.code.fontSize)) {
      errors.push({
        line: lineOf(/^fontSize:/i, /^!(code|snippet|block|codeblock|syntax)\b/i),
        message: `Scene ${index + 1}: Invalid code font size "${scene.code.fontSize}"`,
        severity: "error",
        suggestion: `Valid font sizes: ${CODE_FONT_SIZES.join(", ")}`,
      });
    }

    if (scene.code.fontFamily && !isOneOf(CODE_FONT_FAMILIES, scene.code.fontFamily)) {
      errors.push({
      line: lineOf(/^(fontFamily|font):/i, /^!(code|snippet|block|codeblock|syntax)\b/i),
        message: `Scene ${index + 1}: Invalid code font family "${scene.code.fontFamily}"`,
        severity: "error",
        suggestion: `Valid fonts: ${CODE_FONT_FAMILIES.join(", ")}`,
      });
    }

    if (scene.code.typingSpeed && (scene.code.typingSpeed < 1 || scene.code.typingSpeed > 200)) {
      warnings.push({
      line: lineOf(/^speed:/i, /^!(code|snippet|block|codeblock|syntax)\b/i),
        message: `Scene ${index + 1}: Typing speed ${scene.code.typingSpeed} may be too slow or too fast`,
        severity: "warning",
        suggestion: "Recommended range: 30-100",
      });
    }
  }

  // Validate image scene
  if (scene.type === "image" && scene.image) {
    if (!scene.image.src) {
      errors.push({
      line: lineOf(/^!(image|img|photo|picture)\b/i),
        message: `Scene ${index + 1}: Image source is required`,
        severity: "error",
        suggestion: "Use !image src:https://example.com/image.jpg",
      });
    }

    if (scene.image.fit && !isOneOf(IMAGE_FIT_OPTIONS, scene.image.fit)) {
      errors.push({
      line: lineOf(/\bfit:/i, /^!(image|img|photo|picture)\b/i),
        message: `Scene ${index + 1}: Invalid image fit "${scene.image.fit}"`,
        severity: "error",
        suggestion: `Valid options: ${IMAGE_FIT_OPTIONS.join(", ")}`,
      });
    }

    if (scene.image.position && !isOneOf(IMAGE_POSITIONS, scene.image.position)) {
      errors.push({
      line: lineOf(/\bposition:/i, /^!(image|img|photo|picture)\b/i),
        message: `Scene ${index + 1}: Invalid image position "${scene.image.position}"`,
        severity: "error",
        suggestion: `Valid positions: ${IMAGE_POSITIONS.join(", ")}`,
      });
    }
  }

  // Validate chart scene
  if (scene.type === "chart" && scene.chart) {
    if (!scene.chart.data || scene.chart.data.length === 0) {
      errors.push({
      line: lineOf(/^!(chart|graph|plot|data)\b/i),
        message: `Scene ${index + 1}: Chart data is empty`,
        severity: "error",
      });
    }

    if (scene.chart.type && !isOneOf(CHART_TYPES, scene.chart.type)) {
      errors.push({
      line: lineOf(/^!(chart|graph|plot|data)\b/i),
        message: `Scene ${index + 1}: Invalid chart type "${scene.chart.type}"`,
        severity: "error",
        suggestion: `Valid types: ${CHART_TYPES.join(", ")}`,
      });
    }
  }

  // Validate mockup scene
  if (scene.type === "mockup" && scene.mockup) {
    if (!isOneOf(DEVICE_TYPES, scene.mockup.device)) {
      errors.push({
      line: lineOf(/^!(mockup|device|screen|preview)\b/i),
        message: `Scene ${index + 1}: Invalid device type "${scene.mockup.device}"`,
        severity: "error",
        suggestion: `Valid devices: ${DEVICE_TYPES.join(", ")}`,
      });
    }
  }

  // Validate particles
  if (scene.particles) {
    if (!isOneOf(PARTICLE_TYPES, scene.particles.type)) {
      errors.push({
      line: lineOf(/^!(particles|effects|fx|sparkles)\b/i),
        message: `Scene ${index + 1}: Invalid particle type "${scene.particles.type}"`,
        severity: "error",
        suggestion: `Valid types: ${PARTICLE_TYPES.join(", ")}`,
      });
    }

    if (scene.particles.intensity && !isOneOf(PARTICLE_INTENSITIES, scene.particles.intensity)) {
      errors.push({
        line: lineOf(/\bintensity:/i, /^!(particles|effects|fx|sparkles)\b/i),
        message: `Scene ${index + 1}: Invalid particle intensity "${scene.particles.intensity}"`,
        severity: "error",
        suggestion: `Valid intensities: ${PARTICLE_INTENSITIES.join(", ")}`,
      });
    }
  }

  // Validate camera
  if (scene.camera) {
    if (!isOneOf(CAMERA_EFFECTS, scene.camera.effect)) {
      errors.push({
      line: lineOf(/^!(camera|zoom|pan|move)\b/i),
        message: `Scene ${index + 1}: Invalid camera effect "${scene.camera.effect}"`,
        severity: "error",
        suggestion: `Valid effects: ${CAMERA_EFFECTS.join(", ")}`,
      });
    }
  }

  // Validate presenter
  if (scene.presenter) {
    if (!isOneOf(PRESENTER_POSITIONS, scene.presenter.position)) {
      errors.push({
      line: lineOf(/^!(presenter|avatar|person|speaker)\b/i),
        message: `Scene ${index + 1}: Invalid presenter position "${scene.presenter.position}"`,
        severity: "error",
        suggestion: `Valid positions: ${PRESENTER_POSITIONS.join(", ")}`,
      });
    }

    if (scene.presenter.size && !isOneOf(PRESENTER_SIZES, scene.presenter.size)) {
      errors.push({
        line: lineOf(/\bsize:/i, /^!(presenter|avatar|person|speaker)\b/i),
        message: `Scene ${index + 1}: Invalid presenter size "${scene.presenter.size}"`,
        severity: "error",
        suggestion: `Valid sizes: ${PRESENTER_SIZES.join(", ")}`,
      });
    }

    if (scene.presenter.shape && !isOneOf(PRESENTER_SHAPES, scene.presenter.shape)) {
      errors.push({
        line: lineOf(/\bshape:/i, /^!(presenter|avatar|person|speaker)\b/i),
        message: `Scene ${index + 1}: Invalid presenter shape "${scene.presenter.shape}"`,
        severity: "error",
        suggestion: `Valid shapes: ${PRESENTER_SHAPES.join(", ")}`,
      });
    }
  }

  // Validate emoji
  if (scene.type === "emoji" && scene.emoji) {
    if (!scene.emoji.emoji) {
      errors.push({
      line: lineOf(/^!emoji\b/i),
        message: `Scene ${index + 1}: Emoji is required`,
        severity: "error",
      });
    }

    if (scene.emoji.size && !isOneOf(TEXT_SIZES, scene.emoji.size)) {
      errors.push({
        line: lineOf(/^!emoji\b/i),
        message: `Scene ${index + 1}: Invalid emoji size "${scene.emoji.size}"`,
        severity: "error",
        suggestion: `Valid sizes: ${TEXT_SIZES.join(", ")}`,
      });
    }

    if (scene.emoji.animate && !isOneOf(EMOJI_ANIMATIONS, scene.emoji.animate)) {
      errors.push({
      line: lineOf(/^!emoji\b/i),
        message: `Scene ${index + 1}: Invalid emoji animation "${scene.emoji.animate}"`,
        severity: "error",
        suggestion: `Valid animations: ${EMOJI_ANIMATIONS.join(", ")}`,
      });
    }
  }

  // Validate countdown
  if (scene.type === "countdown" && scene.countdown) {
    if (scene.countdown.from <= 0) {
      errors.push({
      line: lineOf(/^!countdown\b/i),
        message: `Scene ${index + 1}: Countdown value must be positive`,
        severity: "error",
      });
    }

    if (scene.countdown.style && !isOneOf(COUNTDOWN_STYLES, scene.countdown.style)) {
      errors.push({
      line: lineOf(/^!countdown\b/i),
        message: `Scene ${index + 1}: Invalid countdown style "${scene.countdown.style}"`,
        severity: "error",
        suggestion: `Valid styles: ${COUNTDOWN_STYLES.join(", ")}`,
      });
    }
  }

  // Validate progress
  if (scene.type === "progress" && scene.progress) {
    if (scene.progress.value < 0 || (scene.progress.max && scene.progress.value > scene.progress.max)) {
      errors.push({
      line: lineOf(/^!progress\b/i),
        message: `Scene ${index + 1}: Progress value out of range`,
        severity: "error",
      });
    }

    if (scene.progress.style && !isOneOf(PROGRESS_STYLES, scene.progress.style)) {
      errors.push({
      line: lineOf(/^!progress\b/i),
        message: `Scene ${index + 1}: Invalid progress style "${scene.progress.style}"`,
        severity: "error",
        suggestion: `Valid styles: ${PROGRESS_STYLES.join(", ")}`,
      });
    }
  }

  // Validate callout
  if (scene.callout) {
    if (scene.callout.arrow && !isOneOf(CALLOUT_ARROWS, scene.callout.arrow)) {
      errors.push({
        line: lineOf(/\barrow:/i, /^!(callout|note|tip|info|annotation)\b/i),
        message: `Scene ${index + 1}: Invalid callout arrow "${scene.callout.arrow}"`,
        severity: "error",
        suggestion: `Valid directions: ${CALLOUT_ARROWS.join(", ")}`,
      });
    }

    if (scene.callout.style && !isOneOf(CALLOUT_STYLES, scene.callout.style)) {
      errors.push({
        line: lineOf(/\bstyle:/i, /^!(callout|note|tip|info|annotation)\b/i),
        message: `Scene ${index + 1}: Invalid callout style "${scene.callout.style}"`,
        severity: "error",
        suggestion: `Valid styles: ${CALLOUT_STYLES.join(", ")}`,
      });
    }
  }

  // Validate QR code
  if (scene.type === "qr" && scene.qr) {
    if (!scene.qr.url) {
      errors.push({
      line: lineOf(/^!qr\b/i),
        message: `Scene ${index + 1}: QR code URL is required`,
        severity: "error",
      });
    }

    try {
      new URL(scene.qr.url);
    } catch {
      errors.push({
      line: lineOf(/^!qr\b/i),
        message: `Scene ${index + 1}: Invalid QR code URL "${scene.qr.url}"`,
        severity: "error",
      });
    }
  }
}

/**
 * Returns a locator for a scene: the first line inside the scene matching
 * one of the patterns (tried in order), or the scene's opening line.
 * Lines are 1-indexed, matching the parser's sourceMap.
 */
function sceneLineFinder(scene: Scene, lines: string[]) {
  const range = scene.sourceMap?.scene;
  return (...patterns: RegExp[]): number | undefined => {
    if (!range) return undefined;
    const last = Math.min(range.endLine, lines.length);
    for (const pattern of patterns) {
      for (let n = range.startLine; n <= last; n++) {
        if (pattern.test(lines[n - 1].trim())) return n;
      }
    }
    return range.startLine;
  };
}

// ============================================
// Schema-backed source validation
// ============================================

function stripQuotes(value: string): string {
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

/** Directives whose following block may contain schema-declared key:value lines. */
function blockContextFor(directive: CanonicalDirectiveName): CanonicalDirectiveName | null {
  switch (directive) {
    case "text":
    case "code":
    case "terminal":
    case "mockup":
    case "particles":
    case "presenter":
    case "camera":
    case "export":
      return directive;
    case "scene":
    case "image":
    case "chart":
    case "diff":
    case "emoji":
    case "qr":
    case "countdown":
    case "progress":
    case "transition":
    case "callout":
    case "layout":
    case "duration":
    case "background":
    case "chapter":
    case "var":
    case "locale":
    case "locales":
    case "strings":
    case "music":
      return null;
    default:
      return assertNever(directive);
  }
}

function pushValidationError(errors: ValidationError[], error: ValidationError): void {
  const duplicate = errors.some(
    (existing) =>
      existing.line === error.line &&
      existing.message === error.message &&
      existing.severity === error.severity
  );
  if (!duplicate) errors.push(error);
}

function scenePrefix(sceneIndex: number): string {
  return sceneIndex > 0 ? `Scene ${sceneIndex}: ` : "";
}

function errorLabel(schema: DirectiveValueSchema): string {
  return schema.errorLabel ?? schema.name;
}

function pushInvalidValue(
  schema: DirectiveValueSchema,
  value: string,
  line: number,
  sceneIndex: number,
  errors: ValidationError[]
): void {
  const booleanValues = schema.type === "boolean" ? ["true", "false"] : undefined;
  const values = schema.values ?? booleanValues;
  pushValidationError(errors, {
    line,
    message: `${scenePrefix(sceneIndex)}Invalid ${errorLabel(schema)} "${value}"`,
    severity: "error",
    suggestion: values
      ? `Valid ${schema.valuesLabel ?? "values"}: ${values.join(", ")}`
      : undefined,
  });
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

function validateNumericValue(
  schema: DirectiveValueSchema,
  value: string,
  line: number,
  sceneIndex: number,
  errors: ValidationError[]
): void {
  const withoutUnit = schema.unit === "seconds" ? value.replace(/s$/i, "") : value;
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(withoutUnit)) {
    pushInvalidValue(schema, value, line, sceneIndex, errors);
    return;
  }

  const numeric = Number.parseFloat(withoutUnit);
  const label = capitalize(errorLabel(schema));
  const prefix = scenePrefix(sceneIndex);

  if (schema.min !== undefined) {
    const tooSmall = schema.exclusiveMin ? numeric <= schema.min : numeric < schema.min;
    if (tooSmall) {
      pushValidationError(errors, {
        line,
        message: `${prefix}${label} must be ${schema.exclusiveMin ? "greater than" : "at least"} ${schema.min}`,
        severity: "error",
      });
      return;
    }
  }

  if (schema.max !== undefined && numeric > schema.max) {
    pushValidationError(errors, {
      line,
      message: `${prefix}${label} must be at most ${schema.max}`,
      severity: "error",
    });
  }
}

function validateSchemaValue(
  schema: DirectiveValueSchema,
  rawValue: string,
  line: number,
  sceneIndex: number,
  errors: ValidationError[]
): void {
  const value = stripQuotes(rawValue);

  // Source lines are substituted with the same hoisted `!var` map the parser
  // uses. If a `$name` reference is still present afterwards, it was not
  // defined in visible source. Mirror the parser by leaving the text intact,
  // and deliberately do not flag it: the value may be injected by an outer
  // document/template pipeline the validator cannot see.
  if (/\$\w+/.test(value)) return;

  switch (schema.type) {
    case "enum": {
      const values = schema.values ?? [];
      const valid = schema.caseInsensitiveValues
        ? isOneOfCaseInsensitive(values, value)
        : isOneOf(values, value);
      if (!valid) pushInvalidValue(schema, value, line, sceneIndex, errors);
      return;
    }
    case "boolean": {
      if (value !== "true" && value !== "false") {
        pushInvalidValue(schema, value, line, sceneIndex, errors);
      }
      return;
    }
    case "number": {
      validateNumericValue(schema, value, line, sceneIndex, errors);
      return;
    }
    case "string":
    case "color":
    case "url":
    case "array":
    case "object":
      return;
    default:
      return assertNever(schema.type);
  }
}

function validateCameraInline(
  tokens: InlineToken[],
  line: number,
  sceneIndex: number,
  errors: ValidationError[]
): void {
  const first = tokens[0];
  if (!first) return;

  // A bare positional first token is checked by the normal positional schema.
  if (!first.key) return;

  const effectSchema = getDirectivePositional("camera", "effect");
  if (!effectSchema) return;

  const key = first.key.toLowerCase();
  if (key === "duration") return; // Valid; the effect then uses its schema default.

  if (!isOneOf(CAMERA_EFFECTS, key)) {
    pushInvalidValue(effectSchema, first.key, line, sceneIndex, errors);
    return;
  }

  if (first.value === undefined) return;

  // In inline camera position every effect token means `effect:value`, where
  // the value is the numeric camera intensity consumed by the renderer. This
  // is intentionally different from keyframe rows: `- pan:left` uses the pan
  // direction enum, while `!camera pan:0.5` means effect=pan with amount 0.5.
  const valueSchema = getDirectivePositional("camera", "value");
  if (valueSchema) validateSchemaValue(valueSchema, first.value, line, sceneIndex, errors);
}

function validateInlineDirective(
  schema: AnyDirectiveSchema,
  line: string,
  lineNumber: number,
  sceneIndex: number,
  errors: ValidationError[]
): void {
  const directive = parseDirective(line);
  if (!directive) return;

  // Use the parser's effective arguments, including colon-attached shorthand
  // injection (`!zoom:1.3` behaves as `zoom:1.3`).
  const { tokens } = parseInlineArguments(directive.args);

  for (const token of tokens) {
    if (!token.key || token.value === undefined) continue;

    // Camera effect shortcuts (`zoom:1.5`, `pan:0.5`, `shake:0.75`) are
    // validated by validateCameraInline rather than as normal properties.
    if (
      schema.name === "camera" &&
      (isOneOf(CAMERA_EFFECTS, token.key.toLowerCase()) || !getDirectiveProperty(schema.name, token.key))
    ) {
      continue;
    }

    const property = getDirectiveProperty(schema.name, token.key);
    if (property) {
      validateSchemaValue(property, token.value, lineNumber, sceneIndex, errors);
    }
  }

  const positionalTokens = tokens.filter((token) => token.key === undefined);
  schema.positional?.forEach((argument, index) => {
    const token = positionalTokens[index];
    if (token) {
      validateSchemaValue(argument, stripQuotes(token.raw), lineNumber, sceneIndex, errors);
    }
  });

  if (schema.name === "camera") {
    validateCameraInline(tokens, lineNumber, sceneIndex, errors);
  }
}

function validateCameraKeyframeLine(
  line: string,
  lineNumber: number,
  sceneIndex: number,
  errors: ValidationError[]
): void {
  const content = line.replace(/^-\s*/, "");
  for (const token of parseInlineArguments(content).tokens) {
    if (!token.key || token.value === undefined) continue;
    const property = getCameraKeyframeProperty(token.key);
    if (property) {
      validateSchemaValue(property, token.value, lineNumber, sceneIndex, errors);
    }
  }
}

function validateBlockPropertyLine(
  directive: CanonicalDirectiveName,
  line: string,
  lineNumber: number,
  sceneIndex: number,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  const classification = classifyDirectivePropertyLine(directive, line);

  if (classification.kind === "property") {
    validateSchemaValue(
      classification.property.schema,
      classification.property.value,
      lineNumber,
      sceneIndex,
      errors
    );
    return;
  }

  if (classification.kind !== "prose") return;

  // A still-unresolved variable is not evidence of a typo. The parser leaves
  // it as-is, and the value may be supplied outside the visible document.
  if (/\$\w+/.test(classification.attempted.value)) return;

  // The prose heuristic necessarily turns enum/number typos into text. Warn
  // (rather than error) when an exact, lowercase/schema-cased key makes the
  // line look like an attempted property. Case-mismatched keys such as
  // `Color:` do not receive this warning; they are unambiguous prose by spec.
  pushValidationError(warnings, {
    line: lineNumber,
    message: `${scenePrefix(sceneIndex)}looks like property \`${classification.attempted.key}\` but \`${classification.attempted.value}\` is not valid; treating as text`,
    severity: "warning",
  });
}

/**
 * Validate constrained values from the original source rather than relying on
 * parsed scene objects. Several parser branches currently discard invalid
 * values by falling back to defaults, so post-parse validation alone cannot
 * see those mistakes.
 */
function validateSchemaBackedValues(
  lines: string[],
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  // Build the same hoisted variable map as the parser before validating any
  // line. Uses before definitions therefore resolve exactly as they do in
  // parseMarkdown; repeated names use the last definition in document order.
  const variables = collectVariableDefinitions(lines);
  let sceneIndex = 0;
  let currentBlock: CanonicalDirectiveName | null = null;
  let inFence = false;

  lines.forEach((sourceLine, index) => {
    const lineNumber = index + 1;
    const line = substituteVariables(sourceLine.trim(), variables);

    if (line.startsWith("```")) {
      inFence = !inFence;
      if (!inFence && currentBlock === "code") currentBlock = null;
      return;
    }
    if (inFence) return;

    if (line === "---") {
      currentBlock = null;
      return;
    }

    const parsedDirective = parseDirective(line);
    if (parsedDirective) {
      const schema = getDirectiveSchema(parsedDirective.name);
      if (!schema) {
        currentBlock = null;
        return;
      }

      if (schema.name === "scene") {
        sceneIndex++;
        currentBlock = null;
      } else {
        validateInlineDirective(schema, line, lineNumber, sceneIndex, errors);
        currentBlock = blockContextFor(schema.name);
      }
      return;
    }

    if (currentBlock === "camera" && line.startsWith("-")) {
      validateCameraKeyframeLine(line, lineNumber, sceneIndex, errors);
      return;
    }

    if (currentBlock) {
      validateBlockPropertyLine(currentBlock, line, lineNumber, sceneIndex, errors, warnings);
    }
  });
}

/** Every directive name the parser understands, including aliases. */
export const KNOWN_DIRECTIVES: readonly string[] = Array.from(
  new Set<string>([
    ...SCENE_DIRECTIVES,
    ...Object.values(DIRECTIVE_CASES),
    ...Object.keys(KEYWORD_ALIASES),
    // Global blocks handled outside scenes
    "locales",
    "strings",
  ])
).sort();

/** Canonical directives worth suggesting; aliases are accepted but not offered. */
const SUGGESTABLE_DIRECTIVES: readonly string[] = Array.from(
  new Set<string>([...SCENE_DIRECTIVES, ...Object.values(DIRECTIVE_CASES)])
);

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diag = up;
    }
  }
  return prev[b.length];
}

/** The closest known directive to a misspelled one, if any is close enough. */
export function closestDirective(name: string): string | undefined {
  const lower = name.toLowerCase();
  const maxDistance = lower.length <= 4 ? 1 : 2;
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of SUGGESTABLE_DIRECTIVES) {
    const d = editDistance(lower, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return bestDistance <= maxDistance ? best : undefined;
}

/**
 * Validates a directive line
 */
function validateDirective(
  line: string,
  lineNumber: number,
  errors: ValidationError[],
  _warnings: ValidationError[]
): void {
  const directive = line.match(/^!(\w[\w-]*)/)?.[1];
  if (!directive) return;
  if (KNOWN_DIRECTIVES.includes(directive.toLowerCase())) return;

  // The parser skips unknown directives silently, so whatever they were
  // meant to do never happens. Treat them as errors.
  const guess = closestDirective(directive);
  errors.push({
    line: lineNumber,
    message: guess
      ? `Unknown directive "!${directive}". Did you mean "!${guess}"?`
      : `Unknown directive "!${directive}"`,
    severity: "error",
    suggestion: guess ? `Replace with !${guess}` : "See the Guide for available directives",
    fix: guess ? { find: `!${directive}`, replace: `!${guess}` } : undefined,
  });
}

function isSceneDirectiveLine(line: string): boolean {
  const match = line.match(/^!(\w[\w-]*)(?=\s|$)/);
  if (!match) return false;
  return getDirectiveSchema(match[1])?.name === "scene";
}

/**
 * Quick syntax check for basic errors
 */
export function quickSyntaxCheck(markdown: string): {
  hasScenes: boolean;
  sceneCount: number;
  estimatedDuration: number;
  issues: string[];
} {
  const lines = markdown.split(/\r?\n/);
  const issues: string[] = [];
  let sceneCount = 0;
  let estimatedDuration = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Count scenes
    if (isSceneDirectiveLine(line)) {
      sceneCount++;
      estimatedDuration += 3; // Default duration
    }

    // Check for duration directives
    const durationMatch = line.match(/!duration\s+(\d+(?:\.\d+)?)/);
    if (durationMatch && sceneCount > 0) {
      estimatedDuration = estimatedDuration - 3 + Number.parseFloat(durationMatch[1]);
    }

    // Check for unclosed code blocks
    if (line.startsWith("```")) {
      const codeBlockStart = i;
      let foundClose = false;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim().startsWith("```")) {
          foundClose = true;
          i = j;
          break;
        }
      }
      if (!foundClose) {
        issues.push(`Unclosed code block at line ${codeBlockStart + 1}`);
      }
    }
  }

  return {
    hasScenes: sceneCount > 0,
    sceneCount,
    estimatedDuration,
    issues,
  };
}

/**
 * Get syntax suggestions based on context
 */
export function getSyntaxSuggestions(partialMarkdown: string): string[] {
  const suggestions: string[] = [];
  // Use the last non-blank line: the cursor usually sits on an empty line
  // after the directive the user just typed.
  const lines = partialMarkdown.split("\n").map((l) => l.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] ?? "";

  // Suggest scene starters
  if (lastLine === "" || lastLine === "---") {
    suggestions.push("!scene - Start a new scene");
    suggestions.push("!slide - Start a new slide (alias for scene)");
  }

  // Suggest content types after scene
  if (isSceneDirectiveLine(lastLine)) {
    suggestions.push("!text - Add text content");
    suggestions.push("!code - Add code block");
    suggestions.push("!image - Add image");
    suggestions.push("!terminal - Add terminal commands");
    suggestions.push("!chart - Add chart");
  }

  return suggestions;
}

