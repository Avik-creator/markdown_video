/**
 * Authoritative schema for markdown-video directives.
 *
 * Parser tables, MCP documentation, validation, editor completions and the
 * syntax guide all derive from this file. Keep syntax keys (for example `bg`)
 * distinct from internal scene object fields (for example `bgColor`).
 */

// ============================================
// Shared value tables
// ============================================

export const TEXT_FONT_FAMILY_VALUES = ["serif", "sans", "mono", "display"] as const;
export type TextFontFamily = (typeof TEXT_FONT_FAMILY_VALUES)[number];

export const CODE_FONT_FAMILY_VALUES = [
  "mono",
  "jetbrains",
  "fira",
  "source",
  "inconsolata",
  "courier",
] as const;
export type CodeFontFamily = (typeof CODE_FONT_FAMILY_VALUES)[number];

export const ANIMATION_VALUES = [
  "fadeIn",
  "slideUp",
  "slideDown",
  "slideLeft",
  "slideRight",
  "bounceIn",
  "zoomIn",
  "typewriter",
  "none",
] as const;
export type AnimationType = (typeof ANIMATION_VALUES)[number];

export const TRANSITION_VALUES = ["fade", "slide", "wipe", "zoom", "magic", "none"] as const;
export type TransitionType = (typeof TRANSITION_VALUES)[number];

export const TEXT_SIZE_VALUES = ["sm", "md", "lg", "xl", "2xl"] as const;
export type TextSize = (typeof TEXT_SIZE_VALUES)[number];

export const CODE_FONT_SIZE_VALUES = ["xs", "sm", "md", "lg"] as const;
export type CodeFontSize = (typeof CODE_FONT_SIZE_VALUES)[number];

export const PARTICLE_TYPE_VALUES = ["confetti", "snow", "rain", "sparkles", "fireworks"] as const;
export type ParticleType = (typeof PARTICLE_TYPE_VALUES)[number];

export const INTENSITY_VALUES = ["low", "medium", "high"] as const;
export type ParticleIntensity = (typeof INTENSITY_VALUES)[number];
export type ShakeIntensity = ParticleIntensity;

export const DEVICE_TYPE_VALUES = ["iphone", "ipad", "macbook", "browser", "android"] as const;
export type DeviceType = (typeof DEVICE_TYPE_VALUES)[number];

export const CHART_TYPE_VALUES = ["bar", "line", "pie", "donut"] as const;
export type ChartType = (typeof CHART_TYPE_VALUES)[number];

export const CAMERA_EFFECT_VALUES = ["zoom", "pan", "shake"] as const;
export type CameraEffect = (typeof CAMERA_EFFECT_VALUES)[number];

export const PAN_DIRECTION_VALUES = ["left", "right", "up", "down"] as const;
export type PanDirection = (typeof PAN_DIRECTION_VALUES)[number];

export const PRESENTER_POSITION_VALUES = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
export type PresenterPosition = (typeof PRESENTER_POSITION_VALUES)[number];

export const PRESENTER_SIZE_VALUES = ["sm", "md", "lg"] as const;
export type PresenterSize = (typeof PRESENTER_SIZE_VALUES)[number];

export const PRESENTER_SHAPE_VALUES = ["circle", "square", "rounded"] as const;
export type PresenterShape = (typeof PRESENTER_SHAPE_VALUES)[number];

export const EMOJI_ANIMATION_VALUES = ["bounce", "spin", "pulse", "shake", "none"] as const;
export type EmojiAnimation = (typeof EMOJI_ANIMATION_VALUES)[number];

export const COUNTDOWN_STYLE_VALUES = ["digital", "circle", "minimal"] as const;
export type CountdownStyle = (typeof COUNTDOWN_STYLE_VALUES)[number];

export const PROGRESS_STYLE_VALUES = ["bar", "circle", "semicircle"] as const;
export type ProgressStyle = (typeof PROGRESS_STYLE_VALUES)[number];

export const IMAGE_FIT_VALUES = ["cover", "contain", "fill"] as const;
export type ImageFit = (typeof IMAGE_FIT_VALUES)[number];

export const IMAGE_POSITION_VALUES = ["center", "top", "bottom", "left", "right"] as const;
export type ImagePosition = (typeof IMAGE_POSITION_VALUES)[number];

export const EXPORT_FORMAT_VALUES = ["mp4", "reels", "shorts", "slides", "gif"] as const;
export type ExportFormat = (typeof EXPORT_FORMAT_VALUES)[number];

export const ASPECT_RATIO_VALUES = ["16:9", "9:16", "1:1", "4:3"] as const;
export type AspectRatio = (typeof ASPECT_RATIO_VALUES)[number];

export const EXPORT_QUALITY_VALUES = ["low", "medium", "high", "ultra"] as const;
export type ExportQuality = (typeof EXPORT_QUALITY_VALUES)[number];

export const MOCKUP_CONTENT_TYPE_VALUES = ["text", "code", "image"] as const;
export type MockupContentType = (typeof MOCKUP_CONTENT_TYPE_VALUES)[number];

export const CALLOUT_ARROW_VALUES = ["up", "down", "left", "right"] as const;
export type CalloutArrow = (typeof CALLOUT_ARROW_VALUES)[number];

export const CALLOUT_STYLE_VALUES = ["info", "warning", "error", "success"] as const;
export type CalloutStyle = (typeof CALLOUT_STYLE_VALUES)[number];

export const LAYOUT_SPLIT_VALUES = ["horizontal", "vertical"] as const;
export type LayoutSplitDirection = (typeof LAYOUT_SPLIT_VALUES)[number];

// ============================================
// Schema model
// ============================================

export type DirectiveCategory = "scene" | "content" | "effect" | "layout" | "meta";

/**
 * Primitive value kinds understood by the schema. `enum` must provide
 * `values`; `color` and `url` are descriptive string kinds for docs and
 * future validators.
 */
export type DirectiveValueType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "array"
  | "object"
  | "color"
  | "url";

export interface DirectiveValueSchema {
  name: string;
  /** Alternative spellings for the same syntax key. Matching is case-insensitive. */
  aliases?: readonly string[];
  type: DirectiveValueType;
  required: boolean;
  default?: string | number | boolean;
  description: string;
  values?: readonly string[];
  /** Inclusive minimum unless `exclusiveMin` is true. */
  min?: number;
  /** Inclusive maximum. */
  max?: number;
  exclusiveMin?: boolean;
  /** Number written in seconds may use a trailing `s`. */
  unit?: "seconds";
  /** Enum values are case-sensitive unless this is true (font families are normalized). */
  caseInsensitiveValues?: boolean;
  /** Human label used in validation messages, e.g. "font family". */
  errorLabel?: string;
  /** Human label used in suggestions, e.g. "fonts" for "Valid fonts: ...". */
  valuesLabel?: string;
}

export interface DirectivePropertySchema extends DirectiveValueSchema {}

export interface DirectivePositionalSchema extends DirectiveValueSchema {}

export interface DirectiveSchema {
  name: string;
  aliases: readonly string[];
  description: string;
  syntax: string;
  examples: readonly string[];
  category: DirectiveCategory;
  /** Positional arguments after the directive name, in order. */
  positional?: readonly DirectivePositionalSchema[];
  /** `key:value` properties, either inline or in the directive's block. */
  properties?: readonly DirectivePropertySchema[];
  /** Properties valid on camera keyframe lines (`- at:0s zoom:1`). */
  keyframeProperties?: readonly DirectivePropertySchema[];
}

// ============================================
// Directive schema
// ============================================

export const DIRECTIVE_SCHEMAS = [
  {
    name: "scene",
    aliases: ["slide", "frame", "section", "page"],
    description: "Creates a new scene/slide in the video",
    syntax: "!scene",
    category: "scene",
    examples: [
      "!scene\n!text\nWelcome to my video",
      "!slide\n!code\n```javascript\nconsole.log('Hello');\n```",
    ],
  },
  {
    name: "text",
    aliases: ["heading", "title", "h1", "h2", "h3", "paragraph", "p"],
    description: "Adds text content to a scene",
    syntax: "!text [i18n:key | \"inline content\"]",
    category: "content",
    examples: [
      "!text\nHello World\nanimation: fadeIn\nsize: xl",
      '!text "Welcome!" at:0s duration:2s',
      "!text i18n:welcome",
    ],
    properties: [
      {
        name: "animation",
        type: "enum",
        required: false,
        default: "fadeIn",
        description: "Animation type for text entrance",
        values: ANIMATION_VALUES,
        errorLabel: "animation",
        valuesLabel: "animations",
      },
      {
        name: "size",
        type: "enum",
        required: false,
        default: "lg",
        description: "Text size",
        values: TEXT_SIZE_VALUES,
        errorLabel: "text size",
        valuesLabel: "sizes",
      },
      {
        name: "color",
        type: "color",
        required: false,
        description: "Text color (CSS color value)",
      },
      {
        name: "fontFamily",
        aliases: ["fontfamily"],
        type: "enum",
        required: false,
        default: "sans",
        description: "Font family",
        values: TEXT_FONT_FAMILY_VALUES,
        caseInsensitiveValues: true,
        errorLabel: "font family",
        valuesLabel: "fonts",
      },
      {
        name: "stagger",
        type: "number",
        required: false,
        description: "Delay between lines in seconds",
        unit: "seconds",
        min: 0,
      },
      {
        name: "at",
        type: "number",
        required: false,
        description: "Start time for timeline element (seconds)",
        unit: "seconds",
        min: 0,
      },
      {
        name: "duration",
        type: "number",
        required: false,
        description: "Duration for timeline element (seconds)",
        unit: "seconds",
        min: 0,
        exclusiveMin: true,
      },
      {
        name: "i18nKey",
        aliases: ["i18n", "i18nkey"],
        type: "string",
        required: false,
        description: "Localization key for multi-language support",
      },
    ],
  },
  {
    name: "code",
    aliases: ["snippet", "block", "codeblock", "syntax"],
    description: "Adds a code block with syntax highlighting",
    syntax: "!code",
    category: "content",
    examples: [
      "!code\n```javascript\nconst x = 42;\nconsole.log(x);\n```",
      "!code\nhighlight: 2,3\ntyping: true\nspeed: 50\n```python\ndef hello():\n    print('Hello')\n    return True\n```",
      "!code\nhighlight: 1,2,3\nannotations:\n- line: 1 text: \"Import statement\"\n- line: 3 text: \"Main function\"\n```javascript\nimport React from 'react';\n\nfunction App() {\n  return <div>Hello</div>;\n}\n```",
    ],
    properties: [
      {
        name: "highlight",
        type: "string",
        required: false,
        description: "Lines to highlight (e.g., '1,2,5-7')",
      },
      {
        name: "typing",
        type: "boolean",
        required: false,
        default: false,
        description: "Enable typewriter animation",
        errorLabel: "code typing",
      },
      {
        name: "speed",
        type: "number",
        required: false,
        default: 50,
        description: "Typing speed (characters per second)",
        min: 1,
        errorLabel: "code typing speed",
      },
      {
        name: "fontSize",
        aliases: ["fontsize"],
        type: "enum",
        required: false,
        default: "sm",
        description: "Font size",
        values: CODE_FONT_SIZE_VALUES,
        errorLabel: "code font size",
        valuesLabel: "font sizes",
      },
      {
        name: "fontFamily",
        aliases: ["fontfamily"],
        type: "enum",
        required: false,
        default: "mono",
        description: "Font family",
        values: CODE_FONT_FAMILY_VALUES,
        caseInsensitiveValues: true,
        errorLabel: "code font family",
        valuesLabel: "fonts",
      },
      {
        name: "height",
        type: "number",
        required: false,
        description: "Height in pixels",
        min: 1,
      },
      {
        name: "width",
        type: "number",
        required: false,
        description: "Width in pixels",
        min: 1,
      },
      {
        name: "annotations",
        type: "array",
        required: false,
        description: "Code annotations with line numbers and text (format: - line: N text: \"annotation\")",
      },
    ],
  },
  {
    name: "terminal",
    aliases: ["shell", "cli", "console", "cmd", "bash"],
    description: "Creates a terminal/command-line interface scene",
    syntax: "!terminal",
    category: "content",
    examples: [
      "!terminal\ntyping: true\nspeed: 30\n$ npm install\n> Installing packages...",
      "!terminal\n$ ls -la\n> total 48\n> drwxr-xr-x  12 user  staff  384 Jan 1 12:00 .",
    ],
    properties: [
      {
        name: "typing",
        type: "boolean",
        required: false,
        default: true,
        description: "Enable typing animation",
        errorLabel: "terminal typing",
      },
      {
        name: "speed",
        type: "number",
        required: false,
        default: 30,
        description: "Typing speed (characters per second)",
        min: 1,
        errorLabel: "terminal typing speed",
      },
    ],
  },
  {
    name: "image",
    aliases: ["img", "photo", "picture"],
    description: "Displays an image",
    syntax: "!image src:url [fit:cover|contain|fill] [position:center]",
    category: "content",
    examples: [
      "!image src:https://example.com/image.jpg",
      '!image src:/logo.png fit:contain position:center alt:"Company Logo"',
    ],
    properties: [
      {
        name: "src",
        type: "string",
        required: true,
        description: "Image URL or path",
      },
      {
        name: "fit",
        type: "enum",
        required: false,
        default: "cover",
        description: "How the image should fit",
        values: IMAGE_FIT_VALUES,
        errorLabel: "image fit",
        valuesLabel: "options",
      },
      {
        name: "position",
        type: "enum",
        required: false,
        default: "center",
        description: "Image position",
        values: IMAGE_POSITION_VALUES,
        errorLabel: "image position",
        valuesLabel: "positions",
      },
      {
        name: "alt",
        type: "string",
        required: false,
        description: "Alternative text for accessibility",
      },
    ],
  },
  {
    name: "chart",
    aliases: ["graph", "plot", "data"],
    description: "Creates an animated chart",
    syntax: "!chart type:bar|line|pie|donut [animate:true]",
    category: "content",
    examples: [
      "!chart type:bar animate:true\nSales: 100\nExpenses: 80\nProfit: 20",
      "!chart type:pie\nApples: 30\nOranges: 45\nBananas: 25",
    ],
    properties: [
      {
        name: "type",
        type: "enum",
        required: false,
        default: "bar",
        description: "Chart type",
        values: CHART_TYPE_VALUES,
        errorLabel: "chart type",
        valuesLabel: "types",
      },
      {
        name: "animate",
        type: "boolean",
        required: false,
        default: true,
        description: "Enable chart animation",
        errorLabel: "chart animate",
      },
    ],
  },
  {
    name: "diff",
    aliases: [],
    description: "Shows a code diff (additions/removals)",
    syntax: "!diff [language]",
    category: "content",
    examples: [
      "!diff javascript\n  const x = 1;\n- const y = 2;\n+ const y = 3;\n  console.log(x, y);",
    ],
    positional: [
      {
        name: "language",
        type: "string",
        required: false,
        description: "Language used for syntax highlighting",
      },
    ],
  },
  {
    name: "mockup",
    aliases: ["device", "screen", "preview"],
    description: "Displays content in a device mockup",
    syntax: "!mockup device:iphone|ipad|macbook|browser|android",
    category: "layout",
    examples: [
      "!mockup device:iphone bg:#000000\ncontent: text\nHello from iPhone!",
      "!mockup device:browser\nimage: /screenshot.png",
    ],
    properties: [
      {
        name: "device",
        type: "enum",
        required: false,
        default: "browser",
        description: "Device type",
        values: DEVICE_TYPE_VALUES,
        errorLabel: "device type",
        valuesLabel: "devices",
      },
      {
        name: "content",
        type: "enum",
        required: false,
        default: "text",
        description: "Content type",
        values: MOCKUP_CONTENT_TYPE_VALUES,
        errorLabel: "mockup content type",
        valuesLabel: "content types",
      },
      {
        name: "bg",
        aliases: ["background"],
        type: "color",
        required: false,
        default: "#ffffff",
        description: "Background color",
      },
      {
        name: "src",
        aliases: ["image"],
        type: "string",
        required: false,
        description: "Image URL for mockup content",
      },
      {
        name: "fit",
        type: "enum",
        required: false,
        default: "cover",
        description: "Image fit mode for mockup image content",
        values: IMAGE_FIT_VALUES,
        errorLabel: "mockup image fit",
        valuesLabel: "fit options",
      },
      {
        name: "color",
        type: "color",
        required: false,
        description: "Text color for text content",
      },
      {
        name: "size",
        type: "enum",
        required: false,
        default: "md",
        description: "Text size for text content",
        values: TEXT_SIZE_VALUES,
        errorLabel: "mockup text size",
        valuesLabel: "sizes",
      },
    ],
  },
  {
    name: "emoji",
    aliases: [],
    description: "Displays an emoji with animation",
    syntax: "!emoji 🎉 [size:xl] [animate:bounce]",
    category: "content",
    examples: [
      "!emoji 🎉 size:2xl animate:bounce",
      "!emoji 👋 at:1s duration:2s",
    ],
    positional: [
      {
        name: "emoji",
        type: "string",
        required: true,
        description: "Emoji to display",
      },
    ],
    properties: [
      {
        name: "size",
        type: "enum",
        required: false,
        default: "xl",
        description: "Emoji size",
        values: TEXT_SIZE_VALUES,
        errorLabel: "emoji size",
        valuesLabel: "sizes",
      },
      {
        name: "animate",
        type: "enum",
        required: false,
        default: "none",
        description: "Animation effect",
        values: EMOJI_ANIMATION_VALUES,
        errorLabel: "emoji animation",
        valuesLabel: "animations",
      },
      {
        name: "at",
        type: "number",
        required: false,
        description: "Start time for timeline element (seconds)",
        unit: "seconds",
        min: 0,
      },
      {
        name: "duration",
        type: "number",
        required: false,
        description: "Duration for timeline element (seconds)",
        unit: "seconds",
        min: 0,
        exclusiveMin: true,
      },
    ],
  },
  {
    name: "qr",
    aliases: [],
    description: "Generates a QR code",
    syntax: "!qr url:https://example.com [size:200] [bg:transparent]",
    category: "content",
    examples: [
      "!qr url:https://github.com size:300 color:#000000 bg:#ffffff",
      '!qr url:https://example.com label:"Scan me!"',
    ],
    properties: [
      {
        name: "url",
        type: "url",
        required: true,
        description: "URL to encode in QR code",
      },
      {
        name: "size",
        type: "number",
        required: false,
        default: 200,
        description: "QR code size in pixels",
        min: 1,
        errorLabel: "QR code size",
      },
      {
        name: "color",
        type: "color",
        required: false,
        default: "#ffffff",
        description: "QR code color",
      },
      {
        name: "bg",
        type: "color",
        required: false,
        default: "transparent",
        description: "Background color (maps to the rendered QR code's bgColor field)",
      },
      {
        name: "label",
        type: "string",
        required: false,
        description: "Optional label text",
      },
    ],
  },
  {
    name: "countdown",
    aliases: [],
    description: "Creates a countdown timer",
    syntax: "!countdown from:10 [style:digital|circle|minimal]",
    category: "content",
    examples: [
      "!countdown from:5 style:digital color:#ec4899",
      "!countdown from:3 style:circle",
    ],
    properties: [
      {
        name: "from",
        type: "number",
        required: false,
        default: 10,
        description: "Starting number",
        min: 0,
        exclusiveMin: true,
        errorLabel: "countdown value",
      },
      {
        name: "style",
        type: "enum",
        required: false,
        default: "digital",
        description: "Visual style",
        values: COUNTDOWN_STYLE_VALUES,
        errorLabel: "countdown style",
        valuesLabel: "styles",
      },
      {
        name: "color",
        type: "color",
        required: false,
        default: "#ec4899",
        description: "Timer color",
      },
    ],
  },
  {
    name: "progress",
    aliases: [],
    description: "Shows a progress indicator",
    syntax: "!progress value:50 [max:100] [style:bar|circle|semicircle]",
    category: "content",
    examples: [
      "!progress value:75 max:100 style:bar animate:true",
      '!progress value:80 style:circle label:"Loading..."',
    ],
    properties: [
      {
        name: "value",
        type: "number",
        required: false,
        default: 50,
        description: "Current value",
        min: 0,
      },
      {
        name: "max",
        type: "number",
        required: false,
        default: 100,
        description: "Maximum value",
        min: 0,
        exclusiveMin: true,
      },
      {
        name: "style",
        type: "enum",
        required: false,
        default: "bar",
        description: "Progress style",
        values: PROGRESS_STYLE_VALUES,
        errorLabel: "progress style",
        valuesLabel: "styles",
      },
      {
        name: "animate",
        type: "boolean",
        required: false,
        default: true,
        description: "Enable animation",
        errorLabel: "progress animate",
      },
      {
        name: "color",
        type: "color",
        required: false,
        default: "#ec4899",
        description: "Progress color",
      },
      {
        name: "label",
        type: "string",
        required: false,
        description: "Optional label text",
      },
    ],
  },
  {
    name: "transition",
    aliases: ["trans", "effect", "animation"],
    description: "Sets the transition effect between scenes",
    syntax: "!transition fade|slide|wipe|zoom|magic|none [duration]s",
    category: "effect",
    examples: [
      "!transition fade 1s",
      "!transition slide 0.5s",
      "!transition zoom",
    ],
    positional: [
      {
        name: "type",
        type: "enum",
        required: true,
        description: "Transition type",
        values: TRANSITION_VALUES,
        errorLabel: "transition",
        valuesLabel: "transitions",
      },
      {
        name: "duration",
        type: "number",
        required: false,
        default: 0.5,
        description: "Transition duration in seconds",
        unit: "seconds",
        min: 0,
        exclusiveMin: true,
        errorLabel: "transition duration",
      },
    ],
  },
  {
    name: "particles",
    aliases: ["effects", "fx", "sparkles"],
    description: "Adds particle effects to a scene",
    syntax: "!particles type:confetti|snow|rain|sparkles|fireworks [intensity:medium]",
    category: "effect",
    examples: [
      "!particles type:confetti intensity:high",
      "!particles type:snow intensity:low",
    ],
    properties: [
      {
        name: "type",
        type: "enum",
        required: false,
        default: "confetti",
        description: "Particle type",
        values: PARTICLE_TYPE_VALUES,
        errorLabel: "particle type",
        valuesLabel: "types",
      },
      {
        name: "intensity",
        type: "enum",
        required: false,
        default: "medium",
        description: "Particle density",
        values: INTENSITY_VALUES,
        errorLabel: "particle intensity",
        valuesLabel: "intensities",
      },
    ],
  },
  {
    name: "camera",
    aliases: ["zoom", "pan", "move"],
    description: "Adds camera effects (zoom, pan, shake)",
    syntax: "!camera zoom|pan|shake [:value] [duration:1s]",
    category: "effect",
    examples: [
      "!camera zoom:1.5 duration:2s",
      "!camera\n- at:0s zoom:1\n- at:2s zoom:1.5\n- at:4s zoom:1",
      "!camera shake",
    ],
    positional: [
      {
        name: "effect",
        type: "enum",
        required: false,
        default: "zoom",
        description: "Camera effect type (optional when keyframes are used)",
        values: CAMERA_EFFECT_VALUES,
        errorLabel: "camera effect",
        valuesLabel: "effects",
      },
      {
        name: "value",
        type: "number",
        required: false,
        default: 1.5,
        description: "Effect intensity (zoom level or pan amount)",
        errorLabel: "camera value",
      },
      {
        name: "duration",
        type: "number",
        required: false,
        default: 1,
        description: "Effect duration in seconds",
        unit: "seconds",
        min: 0,
        exclusiveMin: true,
        errorLabel: "camera duration",
      },
    ],
    properties: [
      {
        name: "duration",
        type: "number",
        required: false,
        default: 1,
        description: "Effect duration in seconds",
        unit: "seconds",
        min: 0,
        exclusiveMin: true,
        errorLabel: "camera duration",
      },
    ],
    keyframeProperties: [
      {
        name: "at",
        type: "number",
        required: true,
        description: "Keyframe time in seconds",
        unit: "seconds",
        min: 0,
      },
      {
        name: "zoom",
        type: "number",
        required: false,
        description: "Zoom level (1 = normal, 1.5 = 150%)",
        min: 0,
        exclusiveMin: true,
      },
      {
        name: "pan",
        type: "enum",
        required: false,
        description: "Pan direction",
        values: PAN_DIRECTION_VALUES,
        errorLabel: "camera pan direction",
        valuesLabel: "directions",
      },
      {
        name: "shake",
        type: "boolean",
        required: false,
        description: "Enable camera shake",
        errorLabel: "camera shake",
      },
      {
        name: "shakeIntensity",
        type: "enum",
        required: false,
        description: "Shake intensity",
        values: INTENSITY_VALUES,
        errorLabel: "shake intensity",
        valuesLabel: "intensities",
      },
    ],
  },
  {
    name: "presenter",
    aliases: ["avatar", "person", "speaker"],
    description: "Adds a presenter/avatar overlay",
    syntax: "!presenter position:bottom-right [size:md] [shape:circle]",
    category: "effect",
    examples: [
      "!presenter position:bottom-right size:lg shape:circle",
      "!presenter position:top-left size:sm shape:rounded",
    ],
    properties: [
      {
        name: "position",
        type: "enum",
        required: false,
        default: "bottom-right",
        description: "Presenter position",
        values: PRESENTER_POSITION_VALUES,
        errorLabel: "presenter position",
        valuesLabel: "positions",
      },
      {
        name: "size",
        type: "enum",
        required: false,
        default: "md",
        description: "Presenter size",
        values: PRESENTER_SIZE_VALUES,
        errorLabel: "presenter size",
        valuesLabel: "sizes",
      },
      {
        name: "shape",
        type: "enum",
        required: false,
        default: "circle",
        description: "Presenter shape",
        values: PRESENTER_SHAPE_VALUES,
        errorLabel: "presenter shape",
        valuesLabel: "shapes",
      },
    ],
  },
  {
    name: "callout",
    aliases: ["note", "tip", "info", "annotation"],
    description: "Adds a callout/annotation",
    syntax: '!callout "text" [arrow:down] [target:line:3] [style:info]',
    category: "effect",
    examples: [
      '!callout "Important!" arrow:down',
      '!callout "Look here" arrow:right target:line:5 style:warning',
    ],
    positional: [
      {
        name: "text",
        type: "string",
        required: true,
        description: "Callout text",
      },
    ],
    properties: [
      {
        name: "arrow",
        type: "enum",
        required: false,
        default: "down",
        description: "Arrow direction",
        values: CALLOUT_ARROW_VALUES,
        errorLabel: "callout arrow",
        valuesLabel: "directions",
      },
      {
        name: "target",
        type: "string",
        required: false,
        description: "Target element (e.g., 'line:3')",
      },
      {
        name: "style",
        type: "enum",
        required: false,
        default: "info",
        description: "Callout style",
        values: CALLOUT_STYLE_VALUES,
        errorLabel: "callout style",
        valuesLabel: "styles",
      },
    ],
  },
  {
    name: "layout",
    aliases: ["split", "two-column", "columns"],
    description: "Creates a split-screen layout",
    syntax: "!layout split:horizontal|vertical",
    category: "layout",
    examples: [
      "!layout split:horizontal",
      "!layout split:vertical",
    ],
    properties: [
      {
        name: "split",
        type: "enum",
        required: false,
        default: "horizontal",
        description: "Split direction",
        values: LAYOUT_SPLIT_VALUES,
        errorLabel: "layout split direction",
        valuesLabel: "directions",
      },
    ],
  },
  {
    name: "duration",
    aliases: ["time", "length", "dur"],
    description: "Sets the scene duration",
    syntax: "!duration 5s",
    category: "meta",
    examples: [
      "!duration 3",
      "!duration 5.5s",
    ],
    positional: [
      {
        name: "seconds",
        type: "number",
        required: true,
        default: 3,
        description: "Duration in seconds",
        unit: "seconds",
        min: 0,
        exclusiveMin: true,
        errorLabel: "scene duration",
      },
    ],
  },
  {
    name: "background",
    aliases: ["bg", "color", "fill"],
    description: "Sets the scene background color or gradient",
    syntax: "!background #hexcolor | gradient(...)",
    category: "meta",
    examples: [
      "!background #1e1e2e",
      "!background linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    ],
    positional: [
      {
        name: "color",
        type: "color",
        required: true,
        description: "CSS color value or gradient",
      },
    ],
  },
  {
    name: "chapter",
    aliases: ["section-title", "heading-title", "section-heading"],
    description: "Creates a chapter marker in the timeline",
    syntax: '!chapter "Chapter Name"',
    category: "meta",
    examples: [
      '!chapter "Introduction"',
      '!chapter "Main Content"',
    ],
    positional: [
      {
        name: "title",
        type: "string",
        required: true,
        description: "Chapter title",
      },
    ],
  },
  {
    name: "var",
    aliases: ["variable", "v", "const"],
    description: "Defines a reusable variable",
    syntax: "!var name value",
    category: "meta",
    examples: [
      "!var brandColor #3b82f6",
      "!var apiUrl https://api.example.com",
      "!background $brandColor",
    ],
    positional: [
      {
        name: "name",
        type: "string",
        required: true,
        description: "Variable name",
      },
      {
        name: "value",
        type: "string",
        required: true,
        description: "Variable value",
      },
    ],
  },
  {
    name: "locale",
    aliases: [],
    description: "Sets the locale for a scene (i18n support)",
    syntax: "!locale en|es|fr|de|...",
    category: "meta",
    examples: [
      "!locale es\n!scene\n!text\nBienvenido",
      "!locale fr\n!scene\n!text\nBienvenue",
    ],
    positional: [
      {
        name: "code",
        type: "string",
        required: true,
        description: "ISO language code (e.g., 'en', 'es', 'fr')",
      },
    ],
  },
  {
    name: "locales",
    aliases: [],
    description: "Defines supported locales for the video",
    syntax: "!locales en es fr de ...",
    category: "meta",
    examples: [
      "!locales en es fr de",
      "!locales en es fr de ja zh",
    ],
    positional: [
      {
        name: "codes",
        type: "string",
        required: true,
        description: "Space-separated list of ISO language codes",
      },
    ],
  },
  {
    name: "strings",
    aliases: [],
    description: "Defines localization strings for i18n",
    syntax: "!strings",
    category: "meta",
    examples: [
      '!strings\nwelcome:\n  en: "Welcome"\n  es: "Bienvenido"\n  fr: "Bienvenue"\n  de: "Willkommen"',
      '!strings\ntitle:\n  en: "My Video"\n  es: "Mi Video"\ngreeting:\n  en: "Hello"\n  es: "Hola"',
    ],
    properties: [
      {
        name: "key",
        type: "string",
        required: true,
        description: "String key name",
      },
      {
        name: "translations",
        type: "object",
        required: true,
        description: "Translations for each locale (locale: value)",
      },
    ],
  },
  {
    name: "export",
    aliases: [],
    description: "Configures export settings",
    syntax: "!export",
    category: "meta",
    examples: [
      "!export\nformat: mp4\nresolution: 1920x1080\nfps: 30",
      "!export\nformat: reels\naspectRatio: 9:16\nsafeArea: true",
    ],
    properties: [
      {
        name: "format",
        type: "enum",
        required: false,
        default: "mp4",
        description: "Export format",
        values: EXPORT_FORMAT_VALUES,
        errorLabel: "export format",
        valuesLabel: "formats",
      },
      {
        name: "aspectRatio",
        type: "enum",
        required: false,
        default: "16:9",
        description: "Video aspect ratio",
        values: ASPECT_RATIO_VALUES,
        errorLabel: "export aspect ratio",
        valuesLabel: "aspect ratios",
      },
      {
        name: "fps",
        type: "number",
        required: false,
        default: 30,
        description: "Frames per second (5-60)",
        min: 5,
        max: 60,
        errorLabel: "export fps",
      },
      {
        name: "resolution",
        type: "string",
        required: false,
        description: "Video resolution (e.g., '1920x1080')",
      },
      {
        name: "quality",
        type: "enum",
        required: false,
        default: "high",
        description: "Export quality",
        values: EXPORT_QUALITY_VALUES,
        errorLabel: "export quality",
        valuesLabel: "qualities",
      },
      {
        name: "safeArea",
        type: "boolean",
        required: false,
        default: false,
        description: "Enable safe-area guides for vertical formats",
      },
      {
        name: "includeSubtitles",
        type: "boolean",
        required: false,
        default: false,
        description: "Include subtitle track when supported",
      },
    ],
  },
] as const satisfies readonly DirectiveSchema[];

export type CanonicalDirectiveName = (typeof DIRECTIVE_SCHEMAS)[number]["name"];
export type AnyDirectiveSchema = DirectiveSchema & { name: CanonicalDirectiveName };

// ============================================
// Schema lookup helpers
// ============================================

/** Type-safe membership check for readonly string tables. */
export function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return values.some((option) => option === value);
}

/** Case-insensitive membership check for normalized values such as font families. */
export function isOneOfCaseInsensitive<T extends string>(
  values: readonly T[],
  value: string
): value is T {
  const lower = value.toLowerCase();
  return values.some((option) => option.toLowerCase() === lower);
}

/** Exhaustiveness helper for schema-driven switch logic. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected schema value: ${String(value)}`);
}

export const DIRECTIVE_ALIAS_TO_CANONICAL: Readonly<Record<string, CanonicalDirectiveName>> =
  Object.freeze(
    Object.fromEntries(
      DIRECTIVE_SCHEMAS.flatMap((directive) =>
        directive.aliases.map((alias) => [alias.toLowerCase(), directive.name])
      )
    )
  ) as Readonly<Record<string, CanonicalDirectiveName>>;

/** Normalize an alias or canonical directive name. Unknown names are returned lowercase. */
export function normalizeDirectiveName(name: string): string {
  const lower = name.toLowerCase();
  return DIRECTIVE_ALIAS_TO_CANONICAL[lower] ?? lower;
}

/** Type guard for canonical directive names. */
export function isCanonicalDirectiveName(name: string): name is CanonicalDirectiveName {
  const normalized = name.toLowerCase();
  return DIRECTIVE_SCHEMAS.some((directive) => directive.name === normalized);
}

/** Get a directive schema by canonical name or alias. */
export function getDirectiveSchema(name: string): AnyDirectiveSchema | undefined {
  const normalized = normalizeDirectiveName(name);
  return DIRECTIVE_SCHEMAS.find((directive) => directive.name === normalized);
}

function propertyMatches(property: DirectivePropertySchema, key: string): boolean {
  const lower = key.toLowerCase();
  return (
    property.name.toLowerCase() === lower ||
    (property.aliases?.some((alias) => alias.toLowerCase() === lower) ?? false)
  );
}

/**
 * Get a `key:value` property schema. Keys are matched case-insensitively so
 * `fontSize`, `fontsize` and `FONTSize` share the canonical `fontSize` schema.
 */
export function getDirectiveProperty(
  directiveName: string,
  propertyName: string
): DirectivePropertySchema | undefined {
  const directive = getDirectiveSchema(directiveName);
  return directive?.properties?.find((property) => propertyMatches(property, propertyName));
}

/** Get a positional argument schema by name, for example transition `type` or `duration`. */
export function getDirectivePositional(
  directiveName: string,
  argumentName: string
): DirectivePositionalSchema | undefined {
  const directive = getDirectiveSchema(directiveName);
  const lower = argumentName.toLowerCase();
  return directive?.positional?.find((argument) => argument.name.toLowerCase() === lower);
}

/** Get a camera keyframe property schema. */
export function getCameraKeyframeProperty(propertyName: string): DirectivePropertySchema | undefined {
  const lower = propertyName.toLowerCase();
  return getDirectiveSchema("camera")?.keyframeProperties?.find(
    (property) => property.name.toLowerCase() === lower
  );
}

/** Get value options for either a property or a positional argument. */
export function getDirectiveValueOptions(
  directiveName: string,
  valueName: string
): readonly string[] {
  const property = getDirectiveProperty(directiveName, valueName);
  if (property?.values) return property.values;
  const positional = getDirectivePositional(directiveName, valueName);
  if (positional?.values) return positional.values;
  if (normalizeDirectiveName(directiveName) === "camera") {
    return getCameraKeyframeProperty(valueName)?.values ?? [];
  }
  return [];
}

/** Return the schema default for a property, preserving its literal type at call sites. */
export function getDirectivePropertyDefault<T extends string | number | boolean>(
  directiveName: string,
  propertyName: string
): T | undefined {
  return getDirectiveProperty(directiveName, propertyName)?.default as T | undefined;
}

/** Return the schema default for a positional argument. */
export function getDirectivePositionalDefault<T extends string | number | boolean>(
  directiveName: string,
  argumentName: string
): T | undefined {
  return getDirectivePositional(directiveName, argumentName)?.default as T | undefined;
}
