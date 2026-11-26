// Parser constants

export const SCENE_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

// ============================================
// SCHEMA-DERIVED VALUE TABLES
// ============================================

import {
  ANIMATION_VALUES,
  ASPECT_RATIO_VALUES,
  CAMERA_EFFECT_VALUES,
  CALLOUT_ARROW_VALUES,
  CALLOUT_STYLE_VALUES,
  CHART_TYPE_VALUES,
  CODE_FONT_FAMILY_VALUES,
  CODE_FONT_SIZE_VALUES,
  COUNTDOWN_STYLE_VALUES,
  DEVICE_TYPE_VALUES,
  DIRECTIVE_SCHEMAS,
  EMOJI_ANIMATION_VALUES,
  EXPORT_FORMAT_VALUES,
  EXPORT_QUALITY_VALUES,
  IMAGE_FIT_VALUES,
  IMAGE_POSITION_VALUES,
  INTENSITY_VALUES,
  LAYOUT_SPLIT_VALUES,
  MOCKUP_CONTENT_TYPE_VALUES,
  PAN_DIRECTION_VALUES,
  PARTICLE_TYPE_VALUES,
  PRESENTER_POSITION_VALUES,
  PRESENTER_SHAPE_VALUES,
  PRESENTER_SIZE_VALUES,
  PROGRESS_STYLE_VALUES,
  TEXT_FONT_FAMILY_VALUES,
  TEXT_SIZE_VALUES,
  TRANSITION_VALUES,
  getDirectivePositionalDefault,
  getDirectivePropertyDefault,
} from "../directive-schema.js";
import type {
  AnimationType,
  CameraEffect,
  CanonicalDirectiveName,
  CodeFontFamily,
  CodeFontSize,
  CountdownStyle,
  EmojiAnimation,
  ExportFormat,
  ImageFit,
  ImagePosition,
  ParticleIntensity,
  ParticleType,
  PresenterPosition,
  PresenterShape,
  PresenterSize,
  ProgressStyle,
  TextFontFamily,
  TextSize,
  TransitionType,
} from "../directive-schema.js";

export type {
  AnimationType,
  AspectRatio,
  CameraEffect,
  CanonicalDirectiveName,
  ChartType,
  CodeFontFamily,
  CodeFontSize,
  CountdownStyle,
  DeviceType,
  EmojiAnimation,
  ExportFormat,
  ImageFit,
  ImagePosition,
  PanDirection,
  ParticleIntensity,
  ParticleType,
  PresenterPosition,
  PresenterShape,
  PresenterSize,
  ProgressStyle,
  ShakeIntensity,
  TextFontFamily,
  TextSize,
  TransitionType,
} from "../directive-schema.js";

// Font families
export const TEXT_FONT_FAMILIES = TEXT_FONT_FAMILY_VALUES;
export const CODE_FONT_FAMILIES = CODE_FONT_FAMILY_VALUES;

// Animations
export const ANIMATION_TYPES = ANIMATION_VALUES;

// Transitions
export const TRANSITION_TYPES = TRANSITION_VALUES;

// Sizes
export const TEXT_SIZES = TEXT_SIZE_VALUES;
export const CODE_FONT_SIZES = CODE_FONT_SIZE_VALUES;

// Particles
export const PARTICLE_TYPES = PARTICLE_TYPE_VALUES;
export const PARTICLE_INTENSITIES = INTENSITY_VALUES;

// Devices (for mockups)
export const DEVICE_TYPES = DEVICE_TYPE_VALUES;

// Charts
export const CHART_TYPES = CHART_TYPE_VALUES;

// Camera
export const CAMERA_EFFECTS = CAMERA_EFFECT_VALUES;
export const PAN_DIRECTIONS = PAN_DIRECTION_VALUES;
export const SHAKE_INTENSITIES = INTENSITY_VALUES;

// Presenter
export const PRESENTER_POSITIONS = PRESENTER_POSITION_VALUES;
export const PRESENTER_SIZES = PRESENTER_SIZE_VALUES;
export const PRESENTER_SHAPES = PRESENTER_SHAPE_VALUES;

// Emoji
export const EMOJI_ANIMATIONS = EMOJI_ANIMATION_VALUES;

// Countdown
export const COUNTDOWN_STYLES = COUNTDOWN_STYLE_VALUES;

// Progress
export const PROGRESS_STYLES = PROGRESS_STYLE_VALUES;

// Callouts and layout
export const CALLOUT_ARROWS = CALLOUT_ARROW_VALUES;
export const CALLOUT_STYLES = CALLOUT_STYLE_VALUES;
export const LAYOUT_SPLIT_DIRECTIONS = LAYOUT_SPLIT_VALUES;
export const MOCKUP_CONTENT_TYPES = MOCKUP_CONTENT_TYPE_VALUES;

// Image
export const IMAGE_FIT_OPTIONS = IMAGE_FIT_VALUES;
export const IMAGE_POSITIONS = IMAGE_POSITION_VALUES;

// Export
export const EXPORT_FORMATS = EXPORT_FORMAT_VALUES;
export const ASPECT_RATIOS = ASPECT_RATIO_VALUES;
export const EXPORT_QUALITIES = EXPORT_QUALITY_VALUES;

function requiredSchemaDefault<T extends string | number | boolean>(
  value: T | undefined,
  label: string
): T {
  if (value === undefined) {
    throw new Error(`Directive schema is missing a default for ${label}`);
  }
  return value;
}

function propertyDefault<T extends string | number | boolean>(
  directive: string,
  property: string
): T {
  return requiredSchemaDefault(
    getDirectivePropertyDefault<T>(directive, property),
    `${directive}.${property}`
  );
}

function positionalDefault<T extends string | number | boolean>(
  directive: string,
  argument: string
): T {
  return requiredSchemaDefault(
    getDirectivePositionalDefault<T>(directive, argument),
    `${directive}.${argument}`
  );
}

// ============================================
// DEFAULTS
// ============================================

export const DEFAULTS = {
  // Text
  textFontFamily: propertyDefault<TextFontFamily>("text", "fontFamily"),
  textSize: propertyDefault<TextSize>("text", "size"),
  textAnimation: propertyDefault<AnimationType>("text", "animation"),
  textAlign: "center" as const,

  // Code
  codeFontFamily: propertyDefault<CodeFontFamily>("code", "fontFamily"),
  codeFontSize: propertyDefault<CodeFontSize>("code", "fontSize"),
  codeTypingSpeed: propertyDefault<number>("code", "speed"),

  // Scene
  sceneDuration: positionalDefault<number>("duration", "seconds"),
  sceneTransition: "fade" as TransitionType,
  transitionDuration: positionalDefault<number>("transition", "duration"),

  // Particles
  particleType: propertyDefault<ParticleType>("particles", "type"),
  particleIntensity: propertyDefault<ParticleIntensity>("particles", "intensity"),

  // Camera
  cameraEffect: positionalDefault<CameraEffect>("camera", "effect"),
  cameraZoom: positionalDefault<number>("camera", "value"),
  cameraDuration: positionalDefault<number>("camera", "duration"),

  // Presenter
  presenterPosition: propertyDefault<PresenterPosition>("presenter", "position"),
  presenterSize: propertyDefault<PresenterSize>("presenter", "size"),
  presenterShape: propertyDefault<PresenterShape>("presenter", "shape"),

  // Emoji
  emojiSize: propertyDefault<TextSize>("emoji", "size"),
  emojiAnimation: propertyDefault<EmojiAnimation>("emoji", "animate"),

  // Countdown
  countdownFrom: propertyDefault<number>("countdown", "from"),
  countdownStyle: propertyDefault<CountdownStyle>("countdown", "style"),
  countdownColor: "#ec4899",

  // Progress
  progressValue: propertyDefault<number>("progress", "value"),
  progressMax: propertyDefault<number>("progress", "max"),
  progressStyle: propertyDefault<ProgressStyle>("progress", "style"),
  progressColor: "#ec4899",

  // Image
  imageFit: propertyDefault<ImageFit>("image", "fit"),
  imagePosition: propertyDefault<ImagePosition>("image", "position"),

  // Music
  musicVolume: propertyDefault<number>("music", "volume"),
  musicFade: propertyDefault<number>("music", "fade"),
  musicLoop: propertyDefault<boolean>("music", "loop"),

  // Export
  exportFormat: propertyDefault<ExportFormat>("export", "format"),
  exportFps: propertyDefault<number>("export", "fps"),
  exportCaptureWaitTime: 500,
} as const;

// ============================================
// REGEX PATTERNS
// ============================================

export const REGEX_PATTERNS = {
  // Variable declaration: !var name value
  VAR_DECLARATION: /^!var\s+(\w+)\s+(.+)$/,

  // Directive: !word
  DIRECTIVE: /^!(\w+)/,

  // Chapter: !chapter "title"
  CHAPTER: /!chapter\s+"([^"]+)"/,

  // Transition: !transition type [duration]s
  TRANSITION: /!transition\s+(\w+)(?:\s+(\d+(?:\.\d+)?)s)?/,

  // Duration: !duration number[s]
  DURATION: /!duration\s+(\d+(?:\.\d+)?)s?/,

  // Text inline: !text "content" [params]
  TEXT_INLINE: /!text\s+"([^"]+)"(.*)$/,

  // Text i18n: !text i18n:key
  TEXT_I18N: /!text\s+i18n:(\w+)/,

  // Time value: at:number[s]
  TIME_VALUE: /at:([\d.]+)s?/,

  // Duration value: duration:number[s]
  DURATION_VALUE: /duration:([\d.]+)s?/,

  // Animation: animation:word
  ANIMATION: /animation:(\w+)/,

  // Diff: !diff [language]
  DIFF: /!diff\s+(\w+)?/,

  // Chart type: type:word
  CHART_TYPE: /type:(\w+)/,

  // Animate: animate:true|false
  ANIMATE: /animate:(true|false)/,

  // Device: device:word
  DEVICE: /device:(\w+)/,

  // Background: bg:value
  BG: /bg:(\S+)/,

  // Arrow: arrow:word
  ARROW: /arrow:(\w+)/,

  // Target: target:value
  TARGET: /target:(\S+)/,

  // Quoted text: "text"
  QUOTED_TEXT: /"([^"]+)"/,

  // Particles type: type:word
  PARTICLES_TYPE: /type:(\w+)/,

  // Particles intensity: intensity:word
  PARTICLES_INTENSITY: /intensity:(\w+)/,

  // Camera effect: (zoom|pan|shake)
  CAMERA_EFFECT: /(zoom|pan|shake)/,

  // Camera value: :number
  CAMERA_VALUE: /:([\d.]+)/,

  // Camera duration: duration:number[s]
  CAMERA_DURATION: /duration:([\d.]+)s?/,

  // Keyframe at: at:number[s]
  KEYFRAME_AT: /at:([\d.]+)s?/,

  // Keyframe zoom: zoom:number
  KEYFRAME_ZOOM: /zoom:([\d.]+)/,

  // Keyframe pan: pan:word
  KEYFRAME_PAN: /pan:(\w+)/,

  // Keyframe shake: shake:true|false
  KEYFRAME_SHAKE: /shake:(true|false)/,

  // Keyframe shake intensity: shakeIntensity:word
  KEYFRAME_SHAKE_INTENSITY: /shakeIntensity:(\w+)/,

  // Presenter position: position:value
  PRESENTER_POSITION: /position:(\S+)/,

  // Presenter size: size:word
  PRESENTER_SIZE: /size:(\w+)/,

  // Presenter shape: shape:word
  PRESENTER_SHAPE: /shape:(\w+)/,

  // Layout split: split:word
  LAYOUT_SPLIT: /split:(\w+)/,

  // Image src: src:value
  IMAGE_SRC: /src:(\S+)/,

  // Image fit: fit:word
  IMAGE_FIT: /fit:(cover|contain|fill)/,

  // Image position: position:word
  IMAGE_POSITION: /position:(center|top|bottom|left|right)/,

  // Image alt: alt:"text"
  IMAGE_ALT: /alt:"([^"]+)"/,

  // Emoji: !emoji emoji
  EMOJI: /!emoji\s+(\S+)/,

  // Emoji size: size:word
  EMOJI_SIZE: /size:(sm|md|lg|xl|2xl)/,

  // Emoji animate: animate:word
  EMOJI_ANIMATE: /animate:(bounce|spin|pulse|shake|none)/,

  // QR url: url:value
  QR_URL: /url:(\S+)/,

  // QR size: size:number
  QR_SIZE: /size:(\d+)/,

  // QR color: color:value
  QR_COLOR: /color:(\S+)/,

  // QR bg: bg:value
  QR_BG: /bg:(\S+)/,

  // QR label: label:"text"
  QR_LABEL: /label:"([^"]+)"/,

  // Countdown from: from:number
  COUNTDOWN_FROM: /from:(\d+)/,

  // Countdown style: style:word
  COUNTDOWN_STYLE: /style:(digital|circle|minimal)/,

  // Countdown color: color:value
  COUNTDOWN_COLOR: /color:(\S+)/,

  // Progress value: value:number
  PROGRESS_VALUE: /value:(\d+)/,

  // Progress max: max:number
  PROGRESS_MAX: /max:(\d+)/,

  // Progress style: style:word
  PROGRESS_STYLE: /style:(bar|circle|semicircle)/,

  // Progress color: color:value
  PROGRESS_COLOR: /color:(\S+)/,

  // Progress label: label:"text"
  PROGRESS_LABEL: /label:"([^"]+)"/,

  // Background: !background value
  BACKGROUND: /!background\s+(.+)/,

  // Locale: !locale word
  LOCALE: /!locale\s+(\w+)/,
} as const;

// ============================================
// SPECIAL CHARACTERS & DELIMITERS
// ============================================

export const DELIMITERS = {
  SCENE_SEPARATOR: "---",
  DIRECTIVE_PREFIX: "!",
  KEYFRAME_PREFIX: "-",
  CODE_FENCE: "```",
  TERMINAL_PROMPT_DOLLAR: "$",
  TERMINAL_PROMPT_ARROW: ">",
  QUOTE: '"',
  COLON: ":",
  EQUALS: "=",
  COMMA: ",",
  NEWLINE: "\n",
} as const;

// ============================================
// PROPERTY KEYS
// ============================================

export const PROPERTY_KEYS = {
  // Common
  ANIMATION: "animation",
  SIZE: "size",
  COLOR: "color",
  FONT_FAMILY: "fontfamily",
  STAGGER: "stagger",
  AT: "at",
  DURATION: "duration",
  I18N: "i18n",
  I18N_KEY: "i18nkey",

  // Code
  HIGHLIGHT: "highlight",
  ANNOTATIONS: "annotations",
  TYPING: "typing",
  SPEED: "speed",
  FONT_SIZE: "fontsize",
  HEIGHT: "height",
  WIDTH: "width",

  // Mockup
  CONTENT: "content",
  BG: "bg",
  BACKGROUND: "background",
  SRC: "src",
  IMAGE: "image",
  FIT: "fit",

  // Particles
  TYPE: "type",
  INTENSITY: "intensity",

  // Presenter
  POSITION: "position",
  SHAPE: "shape",

  // Countdown
  FROM: "from",
  STYLE: "style",

  // Progress
  VALUE: "value",
  MAX: "max",
  ANIMATE: "animate",
  LABEL: "label",
} as const;

// ============================================
// SPECIAL VALUES
// ============================================

export const SPECIAL_VALUES = {
  TRUE: "true",
  FALSE: "false",
  VERTICAL: "vertical",
  HORIZONTAL: "horizontal",
  DEFAULT_DEVICE: "browser",
  DEFAULT_CHART_TYPE: "bar",
  DEFAULT_ARROW: "down",
  DEFAULT_STYLE: "info",
  DEFAULT_PARTICLE: "confetti",
  DEFAULT_PARTICLE_INTENSITY: "medium",
  DEFAULT_COUNTDOWN_STYLE: "digital",
  DEFAULT_PROGRESS_STYLE: "bar",
  DEFAULT_IMAGE_FIT: "cover",
  DEFAULT_IMAGE_POSITION: "center",
  DEFAULT_QR_URL: "https://example.com",
  DEFAULT_QR_COLOR: "#ffffff",
  DEFAULT_QR_BG: "transparent",
  DEFAULT_COUNTDOWN_COLOR: "#ec4899",
  DEFAULT_PROGRESS_COLOR: "#ec4899",
  DEFAULT_MOCKUP_BG: "#ffffff",
  DEFAULT_MOCKUP_SIZE: "md",
  DEFAULT_MOCKUP_CONTENT_TYPE: "text",
  DEFAULT_MOCKUP_CONTENT_BG: "#ffffff",
  DEFAULT_PRESENTER_POSITION: "bottom-right",
  DEFAULT_PRESENTER_SIZE: "md",
  DEFAULT_PRESENTER_SHAPE: "circle",
  DEFAULT_SPLIT_BG: "#1e1e2e",
  DEFAULT_SPLIT_RATIO: 0.5,
  DEFAULT_SPLIT_DIRECTION: "horizontal",
  DEFAULT_TERMINAL_TYPING: true,
  DEFAULT_TERMINAL_TYPING_SPEED: 30,
  DEFAULT_CODE_TYPING_SPEED: 50,
  DEFAULT_CODE_TYPING: false,
  DEFAULT_CHART_ANIMATE: true,
  DEFAULT_EMOJI_SIZE: "xl",
  DEFAULT_EMOJI_ANIMATE: "none",
  DEFAULT_COUNTDOWN_FROM: 10,
  DEFAULT_PROGRESS_VALUE: 50,
  DEFAULT_PROGRESS_MAX: 100,
  DEFAULT_QR_SIZE: 200,
} as const;

// ============================================
// DIRECTIVE CASE LABELS
// ============================================

function constantCase(name: string): string {
  return name.replace(/-/g, "_").toUpperCase();
}

/**
 * Parser switch labels generated from the schema's canonical directive names.
 * `scene`, `locales`, and `strings` are included even though the parser handles
 * them structurally rather than through the main switch.
 */
type DirectiveCaseMap = {
  readonly [Name in CanonicalDirectiveName as Uppercase<Name>]: Name;
};

export const DIRECTIVE_CASES = Object.freeze(
  Object.fromEntries(
    DIRECTIVE_SCHEMAS.map((directive) => [constantCase(directive.name), directive.name])
  )
) as DirectiveCaseMap;

// ============================================
// CASE-SENSITIVE MATCHING VALUES
// ============================================

export const CASE_SENSITIVE_VALUES = {
  // Code block markers
  CODE_FENCE: "```",

  // Terminal prompts
  TERMINAL_PROMPT_DOLLAR: "$",
  TERMINAL_PROMPT_ARROW: ">",

  // Code properties
  HIGHLIGHT: "highlight:",
  ANNOTATIONS: "annotations:",
  TYPING: "typing:",
  SPEED: "speed:",
  FONT_SIZE: "fontSize:",
  FONT_FAMILY: "fontfamily:",
  HEIGHT: "height:",
  WIDTH: "width:",

  // Terminal properties
  TERMINAL_TYPING: "typing:",
  TERMINAL_SPEED: "speed:",

  // Mockup properties
  CONTENT: "content",
  BG: "bg",
  BACKGROUND: "background",
  COLOR: "color",
  SIZE: "size",
  SRC: "src",
  IMAGE: "image",
  FIT: "fit",

  // Boolean values
  TRUE_VALUE: "true",
  FALSE_VALUE: "false",

  // Content types
  CONTENT_TEXT: "text",
  CONTENT_CODE: "code",
  CONTENT_IMAGE: "image",

  // Image fit values
  FIT_COVER: "cover",
  FIT_CONTAIN: "contain",
  FIT_FILL: "fill",

  // Directions
  DIRECTION_VERTICAL: "vertical",
  DIRECTION_HORIZONTAL: "horizontal",

  // Pan directions
  PAN_LEFT: "left",
  PAN_RIGHT: "right",
  PAN_UP: "up",
  PAN_DOWN: "down",

  // Callout arrows
  ARROW_UP: "up",
  ARROW_DOWN: "down",
  ARROW_LEFT: "left",
  ARROW_RIGHT: "right",

  // Presenter shapes
  SHAPE_CIRCLE: "circle",
  SHAPE_SQUARE: "square",
  SHAPE_ROUNDED: "rounded",

  // Emoji animations
  EMOJI_BOUNCE: "bounce",
  EMOJI_SPIN: "spin",
  EMOJI_PULSE: "pulse",
  EMOJI_SHAKE: "shake",
  EMOJI_NONE: "none",

  // Countdown styles
  COUNTDOWN_DIGITAL: "digital",
  COUNTDOWN_CIRCLE: "circle",
  COUNTDOWN_MINIMAL: "minimal",

  // Progress styles
  PROGRESS_BAR: "bar",
  PROGRESS_CIRCLE: "circle",
  PROGRESS_SEMICIRCLE: "semicircle",

  // Chart types
  CHART_BAR: "bar",
  CHART_LINE: "line",
  CHART_PIE: "pie",
  CHART_DONUT: "donut",

  // Device types
  DEVICE_IPHONE: "iphone",
  DEVICE_IPAD: "ipad",
  DEVICE_MACBOOK: "macbook",
  DEVICE_BROWSER: "browser",
  DEVICE_ANDROID: "android",

  // Particle types
  PARTICLE_CONFETTI: "confetti",
  PARTICLE_SNOW: "snow",
  PARTICLE_RAIN: "rain",
  PARTICLE_SPARKLES: "sparkles",
  PARTICLE_FIREWORKS: "fireworks",

  // Particle intensities
  INTENSITY_LOW: "low",
  INTENSITY_MEDIUM: "medium",
  INTENSITY_HIGH: "high",

  // Camera effects
  CAMERA_ZOOM: "zoom",
  CAMERA_PAN: "pan",
  CAMERA_SHAKE: "shake",

  // Shake intensities
  SHAKE_LOW: "low",
  SHAKE_MEDIUM: "medium",
  SHAKE_HIGH: "high",

  // Presenter positions
  POSITION_TOP_LEFT: "top-left",
  POSITION_TOP_RIGHT: "top-right",
  POSITION_BOTTOM_LEFT: "bottom-left",
  POSITION_BOTTOM_RIGHT: "bottom-right",

  // Presenter sizes
  PRESENTER_SM: "sm",
  PRESENTER_MD: "md",
  PRESENTER_LG: "lg",

  // Text sizes
  SIZE_SM: "sm",
  SIZE_MD: "md",
  SIZE_LG: "lg",
  SIZE_XL: "xl",
  SIZE_2XL: "2xl",

  // Code font sizes
  CODE_SIZE_XS: "xs",
  CODE_SIZE_SM: "sm",
  CODE_SIZE_MD: "md",
  CODE_SIZE_LG: "lg",

  // Text fonts
  FONT_SERIF: "serif",
  FONT_SANS: "sans",
  FONT_MONO: "mono",
  FONT_DISPLAY: "display",

  // Code fonts
  CODE_FONT_MONO: "mono",
  CODE_FONT_JETBRAINS: "jetbrains",
  CODE_FONT_FIRA: "fira",
  CODE_FONT_SOURCE: "source",
  CODE_FONT_INCONSOLATA: "inconsolata",
  CODE_FONT_COURIER: "courier",

  // Animation types
  ANIM_FADE_IN: "fadeIn",
  ANIM_SLIDE_UP: "slideUp",
  ANIM_SLIDE_DOWN: "slideDown",
  ANIM_SLIDE_LEFT: "slideLeft",
  ANIM_SLIDE_RIGHT: "slideRight",
  ANIM_BOUNCE_IN: "bounceIn",
  ANIM_TYPEWRITER: "typewriter",
  ANIM_NONE: "none",

  // Transition types
  TRANS_FADE: "fade",
  TRANS_SLIDE: "slide",
  TRANS_WIPE: "wipe",
  TRANS_ZOOM: "zoom",
  TRANS_MAGIC: "magic",
  TRANS_NONE: "none",

  // Export formats
  FORMAT_MP4: "mp4",
  FORMAT_REELS: "reels",
  FORMAT_SHORTS: "shorts",
  FORMAT_SLIDES: "slides",
  FORMAT_GIF: "gif",

  // Aspect ratios
  ASPECT_16_9: "16:9",
  ASPECT_9_16: "9:16",
  ASPECT_1_1: "1:1",
  ASPECT_4_3: "4:3",
} as const;

// Keyword aliases generated from the authoritative directive schema.
export const KEYWORD_ALIASES = Object.freeze(
  Object.fromEntries(
    DIRECTIVE_SCHEMAS.flatMap((directive) =>
      directive.aliases.map((alias) => [alias.toLowerCase(), directive.name])
    )
  )
) as Readonly<Record<string, CanonicalDirectiveName>>;

const sceneSchema = DIRECTIVE_SCHEMAS.find((directive) => directive.name === "scene");
if (!sceneSchema) {
  throw new Error("Directive schema is missing the scene directive");
}

export const SCENE_DIRECTIVES = Object.freeze([
  sceneSchema.name,
  ...sceneSchema.aliases,
]);
