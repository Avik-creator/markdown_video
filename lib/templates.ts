import type { Template } from "./types"

export const TEMPLATES: Template[] = [
  {
    id: "youtube-intro",
    name: "YouTube Intro",
    description: "Animated intro with bouncing text and confetti effect",
    category: "intro",
    markdown: `!var brandColor #ef4444

!scene
!chapter "Intro"
!text
Your Channel Name
animation: bounceIn
size: 2xl

!particles type:confetti intensity:high
!duration 4s
!background $brandColor
!transition zoom

---

!scene
!text
Subscribe for more!
animation: slideUp
size: lg

!duration 2s
!background #1e1e2e
!transition fade`,
  },
  {
    id: "code-tutorial",
    name: "Code Tutorial",
    description: "Terminal setup followed by code walkthrough with typing",
    category: "tutorial",
    markdown: `!scene
!chapter "Setup"
!terminal
$ npm create next-app
$ cd my-app
$ npm run dev
> Ready on localhost:3000

!duration 5s
!background #0d0d0d
!transition fade

---

!scene
!chapter "Code"
!code
typing: true
speed: 35
highlight: 3-5
\`\`\`typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const data = await fetchData()
  return NextResponse.json(data)
}
\`\`\`

!duration 6s
!background #1e1e2e
!transition slide

---

!scene
!text
Now you know the basics!
animation: fadeIn
size: lg

!duration 3s
!background #22c55e
!transition fade`,
  },
  {
    id: "product-demo",
    name: "Product Demo",
    description: "Device mockup with presenter and feature highlights",
    category: "demo",
    markdown: `!scene
!chapter "Demo"
!mockup device:iphone

!presenter position:bottom-right size:md
!duration 5s
!background #1a1a24
!transition zoom

---

!scene
!mockup device:browser

!callout arrow:up "Click here to get started"
!duration 4s
!background #1a1a24
!transition slide

---

!scene
!chart type:bar animate:true
Speed: 95
Security: 90
Usability: 88

!duration 5s
!background #1e1e2e
!transition fade`,
  },
  {
    id: "stats-showcase",
    name: "Stats Showcase",
    description: "Animated charts and statistics presentation",
    category: "demo",
    markdown: `!scene
!text
Our Results
animation: bounceIn
size: 2xl

!duration 2s
!background #3b82f6
!transition fade

---

!scene
!chart type:bar animate:true
Revenue: 85
Growth: 92
Satisfaction: 98

!duration 5s
!background #1e1e2e
!transition slide

---

!scene
!chart type:donut animate:true
Mobile: 45
Desktop: 35
Tablet: 20

!duration 5s
!background #1a1a24
!transition fade`,
  },
  {
    id: "code-diff",
    name: "Code Changes",
    description: "Before/after code diff visualization",
    category: "tutorial",
    markdown: `!scene
!text
What's New
animation: slideUp
size: xl

!duration 2s
!background #8b5cf6
!transition fade

---

!scene
!diff typescript
- const data = fetchSync()
- console.log(data)
+ const data = await fetchAsync()
+ return NextResponse.json(data)
  // rest unchanged

!duration 5s
!background #1e1e2e
!transition slide`,
  },
  {
    id: "thank-you",
    name: "Thank You Outro",
    description: "Closing scene with celebration effects",
    category: "outro",
    markdown: `!scene
!text
Thanks for Watching!
animation: bounceIn
size: 2xl

!particles type:sparkles intensity:high
!duration 3s
!background #ec4899
!transition zoom

---

!scene
!text
Like & Subscribe
animation: slideUp
size: lg

!particles type:confetti intensity:medium
!duration 3s
!background #8b5cf6
!transition fade`,
  },
  {
    id: "simple-text",
    name: "Simple Text Slides",
    description: "Clean text slides with smooth transitions",
    category: "custom",
    markdown: `!scene
!text
First Point
animation: fadeIn
size: xl

!duration 3s
!background #3b82f6
!transition fade

---

!scene
!text
Second Point
animation: slideUp
size: xl

!duration 3s
!background #8b5cf6
!transition slide

---

!scene
!text
Third Point
animation: bounceIn
size: xl

!duration 3s
!background #22c55e
!transition fade`,
  },
  {
    id: "dramatic-reveal",
    name: "Dramatic Reveal",
    description: "Camera zoom with particle effects",
    category: "intro",
    markdown: `!scene
!text
Coming Soon...
animation: fadeIn
size: lg

!camera zoom:1.3 duration:3s
!particles type:sparkles intensity:low
!duration 4s
!background #0d0d0d
!transition fade

---

!scene
!text
THE BIG REVEAL
animation: bounceIn
size: 2xl

!camera shake:true duration:0.5s
!particles type:confetti intensity:high
!duration 3s
!background #ef4444
!transition zoom`,
  },
]
