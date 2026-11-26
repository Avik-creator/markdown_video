import { getDirectiveValueOptions } from "@/lib/directive-schema";

function schemaValue(directive: string, property: string, value: string): string {
  const options = getDirectiveValueOptions(directive, property);
  if (!options.includes(value)) {
    throw new Error(`"${value}" is not a schema-valid ${directive}.${property} value`);
  }
  return value;
}

// Snippet choices are validated against the schema at module load, so editor
// quick-inserts cannot drift from the values validation and completions offer.
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
