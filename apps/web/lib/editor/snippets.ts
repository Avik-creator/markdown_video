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
];

