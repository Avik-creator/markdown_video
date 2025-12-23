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
} from "../parser/constants";

export interface ValidationError {
  line?: number;
  message: string;
  severity: "error" | "warning" | "info";
  suggestion?: string;
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
      validateScene(scene, index, errors, warnings);
    });

    // Validate directives
    lines.forEach((line, lineNumber) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("!")) {
        validateDirective(trimmed, lineNumber + 1, errors, warnings);
      }
    });

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
  warnings: ValidationError[]
): void {
  // Validate duration
  if (scene.duration <= 0) {
    errors.push({
      message: `Scene ${index + 1}: Duration must be positive`,
      severity: "error",
      suggestion: "Use !duration 3 to set a 3-second duration",
    });
  }

  if (scene.duration > 60) {
    warnings.push({
      message: `Scene ${index + 1}: Very long duration (${scene.duration}s)`,
      severity: "warning",
      suggestion: "Consider breaking long scenes into smaller ones",
    });
  }

  // Validate transition
  if (scene.transition && !TRANSITION_TYPES.includes(scene.transition as any)) {
    errors.push({
      message: `Scene ${index + 1}: Invalid transition "${scene.transition}"`,
      severity: "error",
      suggestion: `Valid transitions: ${TRANSITION_TYPES.join(", ")}`,
    });
  }

  // Validate text scene
  if (scene.type === "text" && scene.text) {
    if (!scene.text.content || scene.text.content.trim() === "") {
      warnings.push({
        message: `Scene ${index + 1}: Text content is empty`,
        severity: "warning",
      });
    }

    if (scene.text.animation && !ANIMATION_TYPES.includes(scene.text.animation as any)) {
      errors.push({
        message: `Scene ${index + 1}: Invalid animation "${scene.text.animation}"`,
        severity: "error",
        suggestion: `Valid animations: ${ANIMATION_TYPES.join(", ")}`,
      });
    }

    if (scene.text.fontFamily && !TEXT_FONT_FAMILIES.includes(scene.text.fontFamily as any)) {
      errors.push({
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
        message: `Scene ${index + 1}: Code content is empty`,
        severity: "warning",
      });
    }

    if (scene.code.fontFamily && !CODE_FONT_FAMILIES.includes(scene.code.fontFamily as any)) {
      errors.push({
        message: `Scene ${index + 1}: Invalid code font family "${scene.code.fontFamily}"`,
        severity: "error",
        suggestion: `Valid fonts: ${CODE_FONT_FAMILIES.join(", ")}`,
      });
    }

    if (scene.code.typingSpeed && (scene.code.typingSpeed < 1 || scene.code.typingSpeed > 200)) {
      warnings.push({
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
        message: `Scene ${index + 1}: Image source is required`,
        severity: "error",
        suggestion: "Use !image src:https://example.com/image.jpg",
      });
    }

    if (scene.image.fit && !IMAGE_FIT_OPTIONS.includes(scene.image.fit as any)) {
      errors.push({
        message: `Scene ${index + 1}: Invalid image fit "${scene.image.fit}"`,
        severity: "error",
        suggestion: `Valid options: ${IMAGE_FIT_OPTIONS.join(", ")}`,
      });
    }

    if (scene.image.position && !IMAGE_POSITIONS.includes(scene.image.position as any)) {
      errors.push({
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
        message: `Scene ${index + 1}: Chart data is empty`,
        severity: "error",
      });
    }

    if (scene.chart.type && !CHART_TYPES.includes(scene.chart.type as any)) {
      errors.push({
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
        message: `Scene ${index + 1}: Emoji is required`,
        severity: "error",
      });
    }

    if (scene.emoji.animate && !EMOJI_ANIMATIONS.includes(scene.emoji.animate as any)) {
      errors.push({
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
        message: `Scene ${index + 1}: Countdown value must be positive`,
        severity: "error",
      });
    }

    if (scene.countdown.style && !COUNTDOWN_STYLES.includes(scene.countdown.style as any)) {
      errors.push({
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
        message: `Scene ${index + 1}: Progress value out of range`,
        severity: "error",
      });
    }

    if (scene.progress.style && !PROGRESS_STYLES.includes(scene.progress.style as any)) {
      errors.push({
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
        message: `Scene ${index + 1}: QR code URL is required`,
        severity: "error",
      });
    }

    try {
      new URL(scene.qr.url);
    } catch {
      errors.push({
        message: `Scene ${index + 1}: Invalid QR code URL "${scene.qr.url}"`,
        severity: "error",
      });
    }
  }
}

/**
 * Validates a directive line
 */
function validateDirective(
  line: string,
  lineNumber: number,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  const directive = line.match(/^!(\w+)/)?.[1];
  if (!directive) return;

  // Check for common typos
  const commonTypos: Record<string, string> = {
    scence: "scene",
    sldie: "slide",
    txt: "text",
    cod: "code",
    img: "image",
    tranzition: "transition",
    duraton: "duration",
    backgrund: "background",
  };

  if (commonTypos[directive]) {
    warnings.push({
      line: lineNumber,
      message: `Possible typo: "!${directive}" - did you mean "!${commonTypos[directive]}"?`,
      severity: "warning",
      suggestion: `Replace with !${commonTypos[directive]}`,
    });
  }
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
  const lines = partialMarkdown.split("\n");
  const lastLine = lines[lines.length - 1]?.trim() || "";

  // Suggest scene starters
  if (lines.length === 0 || lastLine === "---") {
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

