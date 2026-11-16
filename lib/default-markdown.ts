/** The document a new project starts with. */
export const DEFAULT_MARKDOWN = `!var brandColor #3b82f6

!scene
!chapter "Introduction"
!text
Welcome to Markdown Video
animation: bounceIn
size: 2xl

!particles type:sparkles intensity:medium
!duration 3s
!background $brandColor
!transition fade

---

!scene
!text
Create stunning videos with simple markdown
animation: slideUp
size: lg

!duration 3s
!background #8b5cf6
!transition slide

---

!scene
!chapter "Tutorial"
!terminal
$ npm create markdown-video
$ cd my-video
$ npm run dev
> Editor ready at localhost:3000

!duration 5s
!background #0d0d0d
!transition fade

---

!scene
!code
typing: true
speed: 35
highlight: 2-4
\`\`\`typescript
// Create your first scene
export const video = {
  title: "My Video",
  scenes: await parseMarkdown(md)
}
\`\`\`

!duration 6s
!background #1e1e2e
!transition slide

---

!scene
!chapter "Stats"
!chart type:bar animate:true
Features: 95
Ease of Use: 88
Performance: 92

!duration 5s
!background #1a1a24
!transition fade

---

!scene
!text
Try it yourself!
animation: bounceIn
size: xl

!particles type:confetti intensity:high
!camera zoom:1.2 duration:2s
!duration 4s
!background #ec4899
!transition zoom`;
