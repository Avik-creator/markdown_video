/**
 * Schema bindings used by the quick-insert snippets below. Each entry is
 * recorded at module scope but deliberately NOT validated here: a module-level
 * throw would crash the entire app chunk for every user if the invariant ever
 * broke in production. The invariant — every value is a schema-valid option
 * for its directive property — is asserted in
 * lib/editor/__tests__/snippets.test.ts instead, so editor quick-inserts
 * cannot drift from the values validation and completions offer.
 */
const snippetSchemaBindings: Array<{
  directive: string;
  property: string;
  value: string;
}> = [];

export const SNIPPET_SCHEMA_BINDINGS: ReadonlyArray<{
  directive: string;
  property: string;
  value: string;
}> = snippetSchemaBindings;

function schemaValue(directive: string, property: string, value: string): string {
  snippetSchemaBindings.push({ directive, property, value });
  return value;
}

// Snippet interpolation values, each registered above for the schema test.
const V = {
  bounceIn: schemaValue("text", "animation", "bounceIn"),
  slideUp: schemaValue("text", "animation", "slideUp"),
  text2xl: schemaValue("text", "size", "2xl"),
  textLg: schemaValue("text", "size", "lg"),
  transitionFade: schemaValue("transition", "type", "fade"),
  transitionSlide: schemaValue("transition", "type", "slide"),
  transitionZoom: schemaValue("transition", "type", "zoom"),
  chartBar: schemaValue("chart", "type", "bar"),
  mockupIphone: schemaValue("mockup", "device", "iphone"),
  presenterBottomRight: schemaValue("presenter", "position", "bottom-right"),
  confetti: schemaValue("particles", "type", "confetti"),
  highIntensity: schemaValue("particles", "intensity", "high"),
  mediumIntensity: schemaValue("particles", "intensity", "medium"),
  imageContain: schemaValue("image", "fit", "contain"),
  imageCenter: schemaValue("image", "position", "center"),
  layoutHorizontal: schemaValue("layout", "split", "horizontal"),
  emojiBounce: schemaValue("emoji", "animate", "bounce"),
  countdownDigital: schemaValue("countdown", "style", "digital"),
  progressBar: schemaValue("progress", "style", "bar"),
  cameraZoom: schemaValue("camera", "effect", "zoom"),
} as const;

/** Snippets for the editor's quick-insert buttons. */
export const EXAMPLE_TEMPLATES = {
  intro: `!scene
!text
Welcome to My Video
animation: ${V.bounceIn}
size: ${V.text2xl}

!duration 3s
!background #3b82f6
!transition ${V.transitionFade}`,
  code: `!scene
!code
highlight: 2-4
typing: true
speed: 40
\`\`\`typescript
const greeting = "Hello"
console.log(greeting)
// More code here
\`\`\`

!duration 4s
!background #1e1e2e
!transition ${V.transitionSlide}`,
  text: `!scene
!text
Add your message here
animation: ${V.slideUp}
size: ${V.textLg}

!duration 3s
!background #8b5cf6`,
  terminal: `!scene
!terminal
$ npm install next
$ npm run dev
> Ready on http://localhost:3000

!duration 5s
!background #0d0d0d
!transition ${V.transitionSlide}`,
  chart: `!scene
!chart type:${V.chartBar} animate:true
React: 85
Vue: 70
Angular: 60

!duration 5s
!background #1e1e2e
!transition ${V.transitionFade}`,
  mockup: `!scene
!mockup device:${V.mockupIphone}

!presenter position:${V.presenterBottomRight}
!duration 4s
!background #1a1a24
!transition ${V.transitionZoom}`,
  particles: `!scene
!text
Celebration Time!
animation: ${V.bounceIn}
size: ${V.text2xl}

!particles type:${V.confetti} intensity:${V.highIntensity}
!duration 4s
!background #ec4899
!transition ${V.transitionFade}`,
  image: `!scene
!image src:https://example.com/image.jpg fit:${V.imageContain} position:${V.imageCenter} alt:"Product screenshot"

!duration 4s
!background #111827
!transition ${V.transitionFade}`,
  split: `!scene
!layout split:${V.layoutHorizontal}
left:
!text
Left panel copy
right:
!image src:https://example.com/image.jpg fit:${V.imageContain}

!duration 5s
!background #1e1e2e
!transition ${V.transitionSlide}`,
  diff: `!scene
!diff javascript
  const enabled = false;
- const enabled = false;
+ const enabled = true;
  render();

!duration 4s
!background #0f172a
!transition ${V.transitionFade}`,
  qr: `!scene
!qr url:https://example.com size:240 label:"Scan me"

!duration 4s
!background #111111
!transition ${V.transitionFade}`,
  countdown: `!scene
!countdown from:5 style:${V.countdownDigital} color:#ec4899

!duration 5s
!background #18181b
!transition ${V.transitionZoom}`,
  progress: `!scene
!progress value:75 max:100 style:${V.progressBar} animate:true label:"Loading"

!duration 4s
!background #172554
!transition ${V.transitionFade}`,
  emoji: `!scene
!emoji 🎉 size:2xl animate:${V.emojiBounce}

!duration 3s
!background #7c3aed
!transition ${V.transitionFade}`,
};
export interface ExampleSnippet {
  id: keyof typeof EXAMPLE_TEMPLATES;
  name: string;
  description: string;
  keywords: string[];
  markdown: string;
}

/**
 * Presentation metadata for the insertion palette. The markdown itself is
 * always referenced from EXAMPLE_TEMPLATES rather than duplicated, so schema
 * validation and quick-insert behavior continue to share one source.
 */
export const EXAMPLE_SNIPPETS: ExampleSnippet[] = [
  {
    id: "intro",
    name: "Intro",
    description: "Bold animated title card with a fade transition",
    keywords: ["title", "welcome", "opening", "text"],
    markdown: EXAMPLE_TEMPLATES.intro,
  },
  {
    id: "text",
    name: "Text",
    description: "Simple animated message scene",
    keywords: ["message", "copy", "heading"],
    markdown: EXAMPLE_TEMPLATES.text,
  },
  {
    id: "code",
    name: "Code",
    description: "Syntax-highlighted TypeScript with typing and line focus",
    keywords: ["typescript", "programming", "typing", "highlight"],
    markdown: EXAMPLE_TEMPLATES.code,
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Command-line output with a dark shell background",
    keywords: ["shell", "npm", "cli", "command"],
    markdown: EXAMPLE_TEMPLATES.terminal,
  },
  {
    id: "chart",
    name: "Chart",
    description: "Animated bar chart comparing several values",
    keywords: ["graph", "data", "bar", "metrics"],
    markdown: EXAMPLE_TEMPLATES.chart,
  },
  {
    id: "mockup",
    name: "Device mockup",
    description: "Phone mockup scene with a presenter overlay",
    keywords: ["iphone", "mobile", "device", "presenter"],
    markdown: EXAMPLE_TEMPLATES.mockup,
  },
  {
    id: "particles",
    name: "Celebration",
    description: "High-energy text scene with confetti particles",
    keywords: ["confetti", "celebration", "effects", "fun"],
    markdown: EXAMPLE_TEMPLATES.particles,
  },
  {
    id: "image",
    name: "Image",
    description: "Image scene with fit, position, and alt text",
    keywords: ["picture", "photo", "screenshot", "media"],
    markdown: EXAMPLE_TEMPLATES.image,
  },
  {
    id: "split",
    name: "Split layout",
    description: "Two-panel layout with text and image content",
    keywords: ["columns", "layout", "two column", "side by side"],
    markdown: EXAMPLE_TEMPLATES.split,
  },
  {
    id: "diff",
    name: "Diff",
    description: "Code diff with additions and removals",
    keywords: ["git", "code", "changes", "plus minus"],
    markdown: EXAMPLE_TEMPLATES.diff,
  },
  {
    id: "qr",
    name: "QR code",
    description: "QR code with a scan label",
    keywords: ["scan", "link", "code"],
    markdown: EXAMPLE_TEMPLATES.qr,
  },
  {
    id: "countdown",
    name: "Countdown",
    description: "Digital countdown timer scene",
    keywords: ["timer", "numbers", "count"],
    markdown: EXAMPLE_TEMPLATES.countdown,
  },
  {
    id: "progress",
    name: "Progress",
    description: "Animated progress bar scene",
    keywords: ["loading", "bar", "percent", "status"],
    markdown: EXAMPLE_TEMPLATES.progress,
  },
  {
    id: "emoji",
    name: "Emoji",
    description: "Large animated emoji moment",
    keywords: ["reaction", "fun", "icon", "celebration"],
    markdown: EXAMPLE_TEMPLATES.emoji,
  },
];

export interface DirectiveSnippet {
  id: string;
  kind: "directive";
  name: string;
  description: string;
  keywords: string[];
  markdown: string;
}

/**
 * Common scene-scoped directives offered by the same insertion palette. These
 * are deliberately snippets rather than handwritten string concatenation in
 * the palette; schema-significant enum values above are test-validated.
 */
export const DIRECTIVE_SNIPPETS: DirectiveSnippet[] = [
  {
    id: "duration",
    kind: "directive",
    name: "Duration",
    description: "Set the current scene duration",
    keywords: ["time", "seconds", "length"],
    markdown: "!duration 3s",
  },
  {
    id: "background",
    kind: "directive",
    name: "Background",
    description: "Set a scene background color",
    keywords: ["color", "fill", "bg"],
    markdown: "!background #1e1e2e",
  },
  {
    id: "transition",
    kind: "directive",
    name: "Transition",
    description: "Add a fade transition to the scene",
    keywords: ["fade", "motion", "entrance"],
    markdown: `!transition ${V.transitionFade}`,
  },
  {
    id: "chapter",
    kind: "directive",
    name: "Chapter",
    description: "Add a timeline chapter marker",
    keywords: ["section", "marker", "title"],
    markdown: '!chapter "Chapter title"',
  },
  {
    id: "locale",
    kind: "directive",
    name: "Locale override",
    description: "Override the locale for one scene",
    keywords: ["i18n", "language", "localization"],
    markdown: "!locale en",
  },
  {
    id: "particles",
    kind: "directive",
    name: "Particles",
    description: "Add a particle effect to the scene",
    keywords: ["confetti", "effect", "sparkles"],
    markdown: `!particles type:${V.confetti} intensity:${V.mediumIntensity}`,
  },
  {
    id: "presenter",
    kind: "directive",
    name: "Presenter",
    description: "Add a presenter overlay",
    keywords: ["person", "camera", "overlay"],
    markdown: `!presenter position:${V.presenterBottomRight}`,
  },
  {
    id: "camera",
    kind: "directive",
    name: "Camera zoom",
    description: "Add a simple zoom effect",
    keywords: ["pan", "movement", "effect"],
    markdown: `!camera ${V.cameraZoom}:1.5 duration:1s`,
  },
];

export type InsertableSnippet = ExampleSnippet | DirectiveSnippet;

export const INSERTABLE_SNIPPETS: InsertableSnippet[] = [
  ...EXAMPLE_SNIPPETS,
  ...DIRECTIVE_SNIPPETS,
];

