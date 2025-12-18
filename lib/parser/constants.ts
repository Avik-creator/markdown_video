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
// FONT FAMILIES
// ============================================

// Text scene font families
export const TEXT_FONT_FAMILIES = ["serif", "sans", "mono", "display"] as const;
export type TextFontFamily = (typeof TEXT_FONT_FAMILIES)[number];

// Code scene font families
export const CODE_FONT_FAMILIES = [
  "mono",
  "jetbrains",
  "fira",
  "source",
  "inconsolata",
  "courier",
] as const;
export type CodeFontFamily = (typeof CODE_FONT_FAMILIES)[number];

// ============================================
// ANIMATIONS
// ============================================

export const ANIMATION_TYPES = [
  "fadeIn",
  "slideUp",
  "slideDown",
  "slideLeft",
  "slideRight",
  "bounceIn",
  "typewriter",
  "none",
] as const;
export type AnimationType = (typeof ANIMATION_TYPES)[number];

// ============================================
// TRANSITIONS
// ============================================

export const TRANSITION_TYPES = [
  "fade",
  "slide",
  "wipe",
  "zoom",
  "magic",
  "none",
] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

// ============================================
// SIZES
// ============================================

export const TEXT_SIZES = ["sm", "md", "lg", "xl", "2xl"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const CODE_FONT_SIZES = ["xs", "sm", "md", "lg"] as const;
export type CodeFontSize = (typeof CODE_FONT_SIZES)[number];

// ============================================
// PARTICLES
// ============================================

export const PARTICLE_TYPES = [
  "confetti",
  "snow",
  "rain",
  "sparkles",
  "fireworks",
] as const;
export type ParticleType = (typeof PARTICLE_TYPES)[number];

export const PARTICLE_INTENSITIES = ["low", "medium", "high"] as const;
export type ParticleIntensity = (typeof PARTICLE_INTENSITIES)[number];

// ============================================
// DEVICES (for mockups)
// ============================================

export const DEVICE_TYPES = [
  "iphone",
  "ipad",
  "macbook",
  "browser",
  "android",
] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

// ============================================
// CHARTS
// ============================================

export const CHART_TYPES = ["bar", "line", "pie", "donut"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

// ============================================
// CAMERA
// ============================================

export const CAMERA_EFFECTS = ["zoom", "pan", "shake"] as const;
export type CameraEffect = (typeof CAMERA_EFFECTS)[number];

export const PAN_DIRECTIONS = ["left", "right", "up", "down"] as const;
export type PanDirection = (typeof PAN_DIRECTIONS)[number];

export const SHAKE_INTENSITIES = ["low", "medium", "high"] as const;
export type ShakeIntensity = (typeof SHAKE_INTENSITIES)[number];

// ============================================
// PRESENTER
// ============================================

export const PRESENTER_POSITIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
export type PresenterPosition = (typeof PRESENTER_POSITIONS)[number];

export const PRESENTER_SIZES = ["sm", "md", "lg"] as const;
export type PresenterSize = (typeof PRESENTER_SIZES)[number];

export const PRESENTER_SHAPES = ["circle", "square", "rounded"] as const;
export type PresenterShape = (typeof PRESENTER_SHAPES)[number];

// ============================================
// EMOJI
// ============================================

export const EMOJI_ANIMATIONS = [
  "bounce",
  "spin",
  "pulse",
  "shake",
  "none",
] as const;
export type EmojiAnimation = (typeof EMOJI_ANIMATIONS)[number];

// ============================================
// COUNTDOWN
// ============================================

export const COUNTDOWN_STYLES = ["digital", "circle", "minimal"] as const;
export type CountdownStyle = (typeof COUNTDOWN_STYLES)[number];

// ============================================
// PROGRESS
// ============================================

export const PROGRESS_STYLES = ["bar", "circle", "semicircle"] as const;
export type ProgressStyle = (typeof PROGRESS_STYLES)[number];

// ============================================
// IMAGE
// ============================================

export const IMAGE_FIT_OPTIONS = ["cover", "contain", "fill"] as const;
export type ImageFit = (typeof IMAGE_FIT_OPTIONS)[number];

export const IMAGE_POSITIONS = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
] as const;
export type ImagePosition = (typeof IMAGE_POSITIONS)[number];

// ============================================
// EXPORT
// ============================================

export const EXPORT_FORMATS = [
  "mp4",
  "reels",
  "shorts",
  "slides",
  "gif",
] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

// ============================================
// DEFAULTS
// ============================================

export const DEFAULTS = {
  // Text
  textFontFamily: "sans" as TextFontFamily,
  textSize: "lg" as TextSize,
  textAnimation: "fadeIn" as AnimationType,
  textAlign: "center" as const,

  // Code
  codeFontFamily: "mono" as CodeFontFamily,
  codeFontSize: "sm" as CodeFontSize,
  codeTypingSpeed: 50,

  // Scene
  sceneDuration: 3,
  sceneTransition: "fade" as TransitionType,

  // Particles
  particleType: "confetti" as ParticleType,
  particleIntensity: "medium" as ParticleIntensity,

  // Camera
  cameraEffect: "zoom" as CameraEffect,
  cameraZoom: 1.5,
  cameraDuration: 1,

  // Presenter
  presenterPosition: "bottom-right" as PresenterPosition,
  presenterSize: "md" as PresenterSize,
  presenterShape: "circle" as PresenterShape,

  // Emoji
  emojiSize: "xl" as TextSize,
  emojiAnimation: "none" as EmojiAnimation,

  // Countdown
  countdownFrom: 10,
  countdownStyle: "digital" as CountdownStyle,
  countdownColor: "#ec4899",

  // Progress
  progressValue: 50,
  progressMax: 100,
  progressStyle: "bar" as ProgressStyle,
  progressColor: "#ec4899",

  // Image
  imageFit: "cover" as ImageFit,
  imagePosition: "center" as ImagePosition,

  // Export
  exportFormat: "mp4" as ExportFormat,
  exportFps: 30,
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

export const DIRECTIVE_CASES = {
  CHAPTER: "chapter",
  TRANSITION: "transition",
  DURATION: "duration",
  TEXT: "text",
  CODE: "code",
  TERMINAL: "terminal",
  DIFF: "diff",
  CHART: "chart",
  MOCKUP: "mockup",
  CALLOUT: "callout",
  PARTICLES: "particles",
  CAMERA: "camera",
  PRESENTER: "presenter",
  LAYOUT: "layout",
  IMAGE: "image",
  EMOJI: "emoji",
  QR: "qr",
  COUNTDOWN: "countdown",
  PROGRESS: "progress",
  BACKGROUND: "background",
  VAR: "var",
  LOCALE: "locale",
  EXPORT: "export",
} as const;

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

// Keyword aliases - allows alternative keywords to avoid conflicts
export const KEYWORD_ALIASES: Record<string, string> = {
  // Scene aliases
  slide: "scene",
  frame: "scene",
  section: "scene",
  page: "scene",

  // Text aliases
  heading: "text",
  title: "text",
  h1: "text",
  h2: "text",
  h3: "text",
  paragraph: "text",
  p: "text",

  // Code aliases
  snippet: "code",
  block: "code",
  codeblock: "code",
  syntax: "code",

  // Terminal aliases
  shell: "terminal",
  cli: "terminal",
  console: "terminal",
  cmd: "terminal",
  bash: "terminal",

  // Chart aliases
  graph: "chart",
  plot: "chart",
  data: "chart",

  // Mockup aliases
  device: "mockup",
  screen: "mockup",
  preview: "mockup",

  // Image aliases
  img: "image",
  photo: "image",
  picture: "image",

  // Layout/Split aliases
  split: "layout",
  "two-column": "layout",
  columns: "layout",

  // Duration aliases
  time: "duration",
  length: "duration",
  dur: "duration",

  // Background aliases
  bg: "background",
  color: "background",
  fill: "background",

  // Transition aliases
  trans: "transition",
  effect: "transition",
  animation: "transition",

  // Chapter aliases
  "section-title": "chapter",
  "heading-title": "chapter",
  "section-heading": "chapter",

  // Particles aliases
  effects: "particles",
  fx: "particles",
  sparkles: "particles",

  // Camera aliases
  zoom: "camera",
  pan: "camera",
  move: "camera",

  // Presenter aliases
  avatar: "presenter",
  person: "presenter",
  speaker: "presenter",

  // Callout aliases
  note: "callout",
  tip: "callout",
  info: "callout",
  annotation: "callout",

  // Variable aliases
  variable: "var",
  v: "var",
  const: "var",
};

export const SCENE_DIRECTIVES = [
  "scene",
  "slide",
  "frame",
  "section",
  "page",
] as const;
