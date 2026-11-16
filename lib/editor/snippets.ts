/** Snippets for the editor's quick-insert buttons. */
export const EXAMPLE_TEMPLATES = {
  intro: `!scene
!text
Welcome to My Video
animation: bounceIn
size: 2xl

!duration 3s
!background #3b82f6
!transition fade`,
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
!transition slide`,
  text: `!scene
!text
Add your message here
animation: slideUp
size: lg

!duration 3s
!background #8b5cf6`,
  terminal: `!scene
!terminal
$ npm install next
$ npm run dev
> Ready on http://localhost:3000

!duration 5s
!background #0d0d0d
!transition slide`,
  chart: `!scene
!chart type:bar animate:true
React: 85
Vue: 70
Angular: 60

!duration 5s
!background #1e1e2e
!transition fade`,
  mockup: `!scene
!mockup device:iphone

!presenter position:bottom-right
!duration 4s
!background #1a1a24
!transition zoom`,
  particles: `!scene
!text
Celebration Time!
animation: bounceIn
size: 2xl

!particles type:confetti intensity:high
!duration 4s
!background #ec4899
!transition fade`,
};
