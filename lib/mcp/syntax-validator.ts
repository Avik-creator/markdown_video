// Syntax validation utilities for markdown_video
import { parseMarkdownFull } from "../parser";
import type { Scene } from "../types";
import {
  SCENE_DIRECTIVES,
  ANIMATION_TYPES,
  TRANSITION_TYPES,
  TEXT_FONT_FAMILIES,
  CODE_FONT_FAMILIES,
  PARTICLE_TYPES,
  DEVICE_TYPES,
  CHART_TYPES,
  CAMERA_EFFECTS,
  PRESENTER_POSITIONS,
  EMOJI_ANIMATIONS,
  COUNTDOWN_STYLES,
  PROGRESS_STYLES,
  IMAGE_FIT_OPTIONS,
  IMAGE_POSITIONS,
  EXPORT_FORMATS,
  ASPECT_RATIOS,
  DIRECTIVE_CASES,
  KEYWORD_ALIASES,
} from "../parser/constants";

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
  const lines = markdown.split("\n");

  try {
    // Parse the markdown
    const result = parseMarkdownFull(markdown);
    const { scenes, chapters, variables } = result;

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
  // Validate duration
  if (scene.duration <= 0) {
    errors.push({
      line: lineOf(/^!(duration|time|length|dur)\b/i),
      message: `Scene ${index + 1}: Duration must be positive`,
      severity: "error",
      suggestion: "Use !duration 3 to set a 3-second duration",
    });
  }

  if (scene.duration > 60) {
    warnings.push({
      line: lineOf(/^!(duration|time|length|dur)\b/i),
      message: `Scene ${index + 1}: Very long duration (${scene.duration}s)`,
      severity: "warning",
      suggestion: "Consider breaking long scenes into smaller ones",
    });
  }

  // Validate transition
  if (scene.transition && !TRANSITION_TYPES.includes(scene.transition as any)) {
    errors.push({
      line: lineOf(/^!(transition|trans|effect|animation)\b/i),
      message: `Scene ${index + 1}: Invalid transition "${scene.transition}"`,
      severity: "error",
      suggestion: `Valid transitions: ${TRANSITION_TYPES.join(", ")}`,
    });
  }

  // Validate text scene
  if (scene.type === "text" && scene.text) {
    if (!scene.text.content || scene.text.content.trim() === "") {
      warnings.push({
      line: lineOf(/^!(text|heading|title|h1|h2|h3|paragraph|p)\b/i),
        message: `Scene ${index + 1}: Text content is empty`,
        severity: "warning",
      });
    }

    if (scene.text.animation && !ANIMATION_TYPES.includes(scene.text.animation as any)) {
      errors.push({
      line: lineOf(/^animation:/i, /^!(text|heading|title|h1|h2|h3|paragraph|p)\b/i),
        message: `Scene ${index + 1}: Invalid animation "${scene.text.animation}"`,
        severity: "error",
        suggestion: `Valid animations: ${ANIMATION_TYPES.join(", ")}`,
      });
    }

    if (scene.text.fontFamily && !TEXT_FONT_FAMILIES.includes(scene.text.fontFamily as any)) {
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

    if (scene.code.fontFamily && !CODE_FONT_FAMILIES.includes(scene.code.fontFamily as any)) {
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

    if (scene.image.fit && !IMAGE_FIT_OPTIONS.includes(scene.image.fit as any)) {
      errors.push({
      line: lineOf(/\bfit:/i, /^!(image|img|photo|picture)\b/i),
        message: `Scene ${index + 1}: Invalid image fit "${scene.image.fit}"`,
        severity: "error",
        suggestion: `Valid options: ${IMAGE_FIT_OPTIONS.join(", ")}`,
      });
    }

    if (scene.image.position && !IMAGE_POSITIONS.includes(scene.image.position as any)) {
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

    if (scene.chart.type && !CHART_TYPES.includes(scene.chart.type as any)) {
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
    if (!DEVICE_TYPES.includes(scene.mockup.device as any)) {
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
    if (!PARTICLE_TYPES.includes(scene.particles.type as any)) {
      errors.push({
      line: lineOf(/^!(particles|effects|fx|sparkles)\b/i),
        message: `Scene ${index + 1}: Invalid particle type "${scene.particles.type}"`,
        severity: "error",
        suggestion: `Valid types: ${PARTICLE_TYPES.join(", ")}`,
      });
    }
  }

  // Validate camera
  if (scene.camera) {
    if (!CAMERA_EFFECTS.includes(scene.camera.effect as any)) {
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
    if (!PRESENTER_POSITIONS.includes(scene.presenter.position as any)) {
      errors.push({
      line: lineOf(/^!(presenter|avatar|person|speaker)\b/i),
        message: `Scene ${index + 1}: Invalid presenter position "${scene.presenter.position}"`,
        severity: "error",
        suggestion: `Valid positions: ${PRESENTER_POSITIONS.join(", ")}`,
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

    if (scene.emoji.animate && !EMOJI_ANIMATIONS.includes(scene.emoji.animate as any)) {
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

    if (scene.countdown.style && !COUNTDOWN_STYLES.includes(scene.countdown.style as any)) {
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

    if (scene.progress.style && !PROGRESS_STYLES.includes(scene.progress.style as any)) {
      errors.push({
      line: lineOf(/^!progress\b/i),
        message: `Scene ${index + 1}: Invalid progress style "${scene.progress.style}"`,
        severity: "error",
        suggestion: `Valid styles: ${PROGRESS_STYLES.join(", ")}`,
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
  const directive = line.match(/^!(\w+)/)?.[1];
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

/**
 * Quick syntax check for basic errors
 */
export function quickSyntaxCheck(markdown: string): {
  hasScenes: boolean;
  sceneCount: number;
  estimatedDuration: number;
  issues: string[];
} {
  const lines = markdown.split("\n");
  const issues: string[] = [];
  let sceneCount = 0;
  let estimatedDuration = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Count scenes
    if (SCENE_DIRECTIVES.some((dir) => line.startsWith(`!${dir}`))) {
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
  if (SCENE_DIRECTIVES.some((dir) => lastLine.startsWith(`!${dir}`))) {
    suggestions.push("!text - Add text content");
    suggestions.push("!code - Add code block");
    suggestions.push("!image - Add image");
    suggestions.push("!terminal - Add terminal commands");
    suggestions.push("!chart - Add chart");
  }

  return suggestions;
}

