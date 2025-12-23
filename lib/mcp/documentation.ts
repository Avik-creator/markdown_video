// Documentation and guide utilities for markdown_video MCP
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
  EXPORT_FORMATS,
  ASPECT_RATIOS,
} from "../parser/constants";

export interface DirectiveDoc {
  name: string;
  aliases: string[];
  description: string;
  syntax: string;
  examples: string[];
  properties?: PropertyDoc[];
  category: "scene" | "content" | "effect" | "layout" | "meta";
}

export interface PropertyDoc {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
  values?: string[];
}

/**
 * Get comprehensive documentation for all directives
 */
export function getAllDirectives(): DirectiveDoc[] {
  return [
    // Scene directives
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

    // Content directives
    {
      name: "text",
      aliases: ["heading", "title", "paragraph"],
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
          type: "string",
          required: false,
          default: "fadeIn",
          description: "Animation type for text entrance",
          values: Array.from(ANIMATION_TYPES),
        },
        {
          name: "size",
          type: "string",
          required: false,
          default: "lg",
          description: "Text size",
          values: ["sm", "md", "lg", "xl", "2xl"],
        },
        {
          name: "color",
          type: "string",
          required: false,
          description: "Text color (CSS color value)",
        },
        {
          name: "fontFamily",
          type: "string",
          required: false,
          default: "sans",
          description: "Font family",
          values: Array.from(TEXT_FONT_FAMILIES),
        },
        {
          name: "stagger",
          type: "number",
          required: false,
          description: "Delay between lines in seconds",
        },
        {
          name: "at",
          type: "number",
          required: false,
          description: "Start time for timeline element (seconds)",
        },
        {
          name: "duration",
          type: "number",
          required: false,
          description: "Duration for timeline element (seconds)",
        },
        {
          name: "i18nKey",
          type: "string",
          required: false,
          description: "Localization key for multi-language support",
        },
      ],
    },

    {
      name: "code",
      aliases: ["snippet", "codeblock"],
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
          default: "false",
          description: "Enable typewriter animation",
        },
        {
          name: "speed",
          type: "number",
          required: false,
          default: "50",
          description: "Typing speed (characters per second)",
        },
        {
          name: "fontSize",
          type: "string",
          required: false,
          default: "sm",
          description: "Font size",
          values: ["xs", "sm", "md", "lg"],
        },
        {
          name: "fontFamily",
          type: "string",
          required: false,
          default: "mono",
          description: "Font family",
          values: Array.from(CODE_FONT_FAMILIES),
        },
        {
          name: "height",
          type: "number",
          required: false,
          description: "Height in pixels",
        },
        {
          name: "width",
          type: "number",
          required: false,
          description: "Width in pixels",
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
      aliases: ["shell", "cli", "console"],
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
          default: "true",
          description: "Enable typing animation",
        },
        {
          name: "speed",
          type: "number",
          required: false,
          default: "30",
          description: "Typing speed (characters per second)",
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
          type: "string",
          required: false,
          default: "cover",
          description: "How the image should fit",
          values: Array.from(IMAGE_FIT_OPTIONS),
        },
        {
          name: "position",
          type: "string",
          required: false,
          default: "center",
          description: "Image position",
          values: ["center", "top", "bottom", "left", "right"],
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
      aliases: ["graph", "plot"],
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
          type: "string",
          required: false,
          default: "bar",
          description: "Chart type",
          values: Array.from(CHART_TYPES),
        },
        {
          name: "animate",
          type: "boolean",
          required: false,
          default: "true",
          description: "Enable chart animation",
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
    },

    {
      name: "mockup",
      aliases: ["device", "screen"],
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
          type: "string",
          required: false,
          default: "browser",
          description: "Device type",
          values: Array.from(DEVICE_TYPES),
        },
        {
          name: "content",
          type: "string",
          required: false,
          default: "text",
          description: "Content type",
          values: ["text", "code", "image"],
        },
        {
          name: "bg",
          type: "string",
          required: false,
          default: "#ffffff",
          description: "Background color",
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
        '!emoji 👋 at:1s duration:2s',
      ],
      properties: [
        {
          name: "size",
          type: "string",
          required: false,
          default: "xl",
          description: "Emoji size",
          values: ["sm", "md", "lg", "xl", "2xl"],
        },
        {
          name: "animate",
          type: "string",
          required: false,
          default: "none",
          description: "Animation effect",
          values: Array.from(EMOJI_ANIMATIONS),
        },
      ],
    },

    {
      name: "qr",
      aliases: [],
      description: "Generates a QR code",
      syntax: "!qr url:https://example.com [size:200]",
      category: "content",
      examples: [
        "!qr url:https://github.com size:300 color:#000000",
        '!qr url:https://example.com label:"Scan me!"',
      ],
      properties: [
        {
          name: "url",
          type: "string",
          required: true,
          description: "URL to encode in QR code",
        },
        {
          name: "size",
          type: "number",
          required: false,
          default: "200",
          description: "QR code size in pixels",
        },
        {
          name: "color",
          type: "string",
          required: false,
          default: "#ffffff",
          description: "QR code color",
        },
        {
          name: "bgColor",
          type: "string",
          required: false,
          default: "transparent",
          description: "Background color",
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
          default: "10",
          description: "Starting number",
        },
        {
          name: "style",
          type: "string",
          required: false,
          default: "digital",
          description: "Visual style",
          values: Array.from(COUNTDOWN_STYLES),
        },
        {
          name: "color",
          type: "string",
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
          default: "50",
          description: "Current value",
        },
        {
          name: "max",
          type: "number",
          required: false,
          default: "100",
          description: "Maximum value",
        },
        {
          name: "style",
          type: "string",
          required: false,
          default: "bar",
          description: "Progress style",
          values: Array.from(PROGRESS_STYLES),
        },
        {
          name: "animate",
          type: "boolean",
          required: false,
          default: "true",
          description: "Enable animation",
        },
        {
          name: "color",
          type: "string",
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

    // Effect directives
    {
      name: "transition",
      aliases: ["trans"],
      description: "Sets the transition effect between scenes",
      syntax: "!transition fade|slide|wipe|zoom|magic|none [duration]s",
      category: "effect",
      examples: [
        "!transition fade 1s",
        "!transition slide 0.5s",
        "!transition zoom",
      ],
      properties: [
        {
          name: "type",
          type: "string",
          required: true,
          description: "Transition type",
          values: Array.from(TRANSITION_TYPES),
        },
        {
          name: "duration",
          type: "number",
          required: false,
          default: "0.5",
          description: "Transition duration in seconds",
        },
      ],
    },

    {
      name: "particles",
      aliases: ["effects", "fx"],
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
          type: "string",
          required: false,
          default: "confetti",
          description: "Particle type",
          values: Array.from(PARTICLE_TYPES),
        },
        {
          name: "intensity",
          type: "string",
          required: false,
          default: "medium",
          description: "Particle density",
          values: ["low", "medium", "high"],
        },
      ],
    },

    {
      name: "camera",
      aliases: ["zoom", "pan"],
      description: "Adds camera effects (zoom, pan, shake)",
      syntax: "!camera zoom|pan|shake [:value] [duration:1s]",
      category: "effect",
      examples: [
        "!camera zoom:1.5 duration:2s",
        "!camera\n- at:0s zoom:1\n- at:2s zoom:1.5\n- at:4s zoom:1",
        "!camera shake",
      ],
      properties: [
        {
          name: "effect",
          type: "string",
          required: true,
          description: "Camera effect type",
          values: Array.from(CAMERA_EFFECTS),
        },
        {
          name: "value",
          type: "number",
          required: false,
          default: "1.5",
          description: "Effect intensity (zoom level, pan amount, etc.)",
        },
        {
          name: "duration",
          type: "number",
          required: false,
          default: "1",
          description: "Effect duration in seconds",
        },
      ],
    },

    {
      name: "presenter",
      aliases: ["avatar", "speaker"],
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
          type: "string",
          required: false,
          default: "bottom-right",
          description: "Presenter position",
          values: Array.from(PRESENTER_POSITIONS),
        },
        {
          name: "size",
          type: "string",
          required: false,
          default: "md",
          description: "Presenter size",
          values: ["sm", "md", "lg"],
        },
        {
          name: "shape",
          type: "string",
          required: false,
          default: "circle",
          description: "Presenter shape",
          values: ["circle", "square", "rounded"],
        },
      ],
    },

    {
      name: "callout",
      aliases: ["note", "tip", "annotation"],
      description: "Adds a callout/annotation",
      syntax: '!callout "text" [arrow:down] [target:line:3]',
      category: "effect",
      examples: [
        '!callout "Important!" arrow:down',
        '!callout "Look here" arrow:right target:line:5',
      ],
      properties: [
        {
          name: "text",
          type: "string",
          required: true,
          description: "Callout text",
        },
        {
          name: "arrow",
          type: "string",
          required: false,
          default: "down",
          description: "Arrow direction",
          values: ["up", "down", "left", "right"],
        },
        {
          name: "target",
          type: "string",
          required: false,
          description: "Target element (e.g., 'line:3')",
        },
        {
          name: "style",
          type: "string",
          required: false,
          default: "info",
          description: "Callout style",
          values: ["info", "warning", "error", "success"],
        },
      ],
    },

    // Layout directives
    {
      name: "layout",
      aliases: ["split"],
      description: "Creates a split-screen layout",
      syntax: "!layout split:horizontal|vertical",
      category: "layout",
      examples: [
        "!layout split:horizontal",
        "!layout split:vertical",
      ],
    },

    // Meta directives
    {
      name: "duration",
      aliases: ["time", "length"],
      description: "Sets the scene duration",
      syntax: "!duration 5s",
      category: "meta",
      examples: [
        "!duration 3",
        "!duration 5.5s",
      ],
      properties: [
        {
          name: "seconds",
          type: "number",
          required: true,
          description: "Duration in seconds",
        },
      ],
    },

    {
      name: "background",
      aliases: ["bg"],
      description: "Sets the scene background color or gradient",
      syntax: "!background #hexcolor | gradient(...)",
      category: "meta",
      examples: [
        "!background #1e1e2e",
        "!background linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      ],
      properties: [
        {
          name: "color",
          type: "string",
          required: true,
          description: "CSS color value or gradient",
        },
      ],
    },

    {
      name: "chapter",
      aliases: ["section-title"],
      description: "Creates a chapter marker in the timeline",
      syntax: '!chapter "Chapter Name"',
      category: "meta",
      examples: [
        '!chapter "Introduction"',
        '!chapter "Main Content"',
      ],
      properties: [
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
      aliases: ["variable"],
      description: "Defines a reusable variable",
      syntax: "!var name value",
      category: "meta",
      examples: [
        "!var brandColor #3b82f6",
        "!var apiUrl https://api.example.com",
        "!background $brandColor",
      ],
      properties: [
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
      properties: [
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
      properties: [
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
        "!strings\nwelcome:\n  en: \"Welcome\"\n  es: \"Bienvenido\"\n  fr: \"Bienvenue\"\n  de: \"Willkommen\"",
        "!strings\ntitle:\n  en: \"My Video\"\n  es: \"Mi Video\"\ngreeting:\n  en: \"Hello\"\n  es: \"Hola\"",
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
        "!export\nformat: reels\naspectRatio: 9:16",
      ],
      properties: [
        {
          name: "format",
          type: "string",
          required: false,
          default: "mp4",
          description: "Export format",
          values: Array.from(EXPORT_FORMATS),
        },
        {
          name: "aspectRatio",
          type: "string",
          required: false,
          default: "16:9",
          description: "Video aspect ratio",
          values: Array.from(ASPECT_RATIOS),
        },
        {
          name: "fps",
          type: "number",
          required: false,
          default: "30",
          description: "Frames per second (5-60)",
        },
        {
          name: "resolution",
          type: "string",
          required: false,
          description: "Video resolution (e.g., '1920x1080')",
        },
      ],
    },
  ];
}

/**
 * Get documentation for a specific directive
 */
export function getDirectiveDoc(directiveName: string): DirectiveDoc | null {
  const allDocs = getAllDirectives();
  return (
    allDocs.find(
      (doc) =>
        doc.name === directiveName ||
        doc.aliases.includes(directiveName)
    ) || null
  );
}

/**
 * Get quick reference guide
 */
export function getQuickReference(): string {
  return `# Markdown Video - Quick Reference

## Basic Structure
\`\`\`markdown
!scene
!text
Your text content here

---

!scene
!code
\`\`\`javascript
console.log("Hello World");
\`\`\`
\`\`\`

## Common Directives
- \`!scene\` / \`!slide\` - Start a new scene
- \`!text\` - Add text content
- \`!code\` - Add code block
- \`!image\` - Display image
- \`!terminal\` - Terminal commands
- \`!chart\` - Data visualization
- \`!duration 3\` - Set scene duration (seconds)
- \`!transition fade\` - Set transition effect
- \`!background #1e1e2e\` - Set background color

## Animations
${ANIMATION_TYPES.join(", ")}

## Transitions
${TRANSITION_TYPES.join(", ")}

## Effects
- \`!particles type:confetti\` - Particle effects
- \`!camera zoom:1.5\` - Camera effects
- \`!presenter position:bottom-right\` - Add presenter overlay
- \`!callout "text"\` - Add annotation

## Scene Separator
Use \`---\` to separate scenes

## Variables
\`\`\`markdown
!var brandColor #3b82f6
!background $brandColor
\`\`\`

## Complete Example
\`\`\`markdown
!var mainColor #3b82f6

!scene
!chapter "Introduction"
!duration 5
!background $mainColor
!text
Welcome to Markdown Video
animation: fadeIn
size: 2xl

---

!scene
!transition slide 1s
!code
typing: true
speed: 50
\`\`\`javascript
function hello() {
  console.log("Hello World!");
}
\`\`\`

---

!scene
!image src:/screenshot.png fit:contain
!callout "Beautiful, isn't it?" arrow:down
\`\`\`
`;
}

/**
 * Get examples by category
 */
export function getExamplesByCategory(category: string): string[] {
  const allDocs = getAllDirectives();
  return allDocs
    .filter((doc) => doc.category === category)
    .flatMap((doc) => doc.examples);
}

/**
 * Search documentation
 */
export function searchDocumentation(query: string): DirectiveDoc[] {
  const allDocs = getAllDirectives();
  const lowerQuery = query.toLowerCase();

  return allDocs.filter(
    (doc) =>
      doc.name.toLowerCase().includes(lowerQuery) ||
      doc.aliases.some((alias) => alias.toLowerCase().includes(lowerQuery)) ||
      doc.description.toLowerCase().includes(lowerQuery)
  );
}

