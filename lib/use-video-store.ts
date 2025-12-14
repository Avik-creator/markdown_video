import { create } from "zustand"
import { persist } from "zustand/middleware"
import { parseMarkdown, getTimelineSegments } from "./parser"
import type { Scene } from "./types"

interface TimelineSegment {
  sceneId: string
  startTime: number
  endTime: number
  duration: number
  color: string
  label: string
  chapter?: string
}

interface HistoryState {
  past: string[]
  future: string[]
}

type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3"
type ZoomLevel = 50 | 75 | 100 | 125 | 150

type ThemePreset = "default" | "monokai" | "dracula" | "nord" | "github"

interface Marker {
  id: string
  time: number
  label: string
  color: string
}

interface VideoStore {
  // Core state
  markdown: string
  setMarkdown: (markdown: string, addToHistory?: boolean) => void
  scenes: Scene[]
  segments: TimelineSegment[]
  totalDuration: number
  isPlaying: boolean
  currentTime: number
  showGuide: boolean

  history: HistoryState
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  aspectRatio: AspectRatio
  setAspectRatio: (ratio: AspectRatio) => void
  zoom: ZoomLevel
  setZoom: (zoom: ZoomLevel) => void

  theme: ThemePreset
  setTheme: (theme: ThemePreset) => void

  markers: Marker[]
  addMarker: (time: number, label: string) => void
  removeMarker: (id: string) => void

  findText: string
  replaceText: string
  setFindText: (text: string) => void
  setReplaceText: (text: string) => void
  findNext: () => number
  replaceNext: () => void
  replaceAll: () => void

  // Playback controls
  play: () => void
  pause: () => void
  toggle: () => void
  seekTo: (time: number) => void
  toggleGuide: () => void
  playbackSpeed: number
  setPlaybackSpeed: (speed: number) => void

  nextFrame: () => void
  prevFrame: () => void
  nextScene: () => void
  prevScene: () => void
}

const DEFAULT_MARKDOWN = `!var brandColor #3b82f6

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
!transition zoom`

function parseAndComputeSegments(markdown: string) {
  const scenes = parseMarkdown(markdown)
  const { segments, totalDuration } = getTimelineSegments(scenes)
  return { scenes, segments, totalDuration }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export const useVideoStore = create<VideoStore>()(
  persist(
    (set, get) => {
      const initial = parseAndComputeSegments(DEFAULT_MARKDOWN)

      return {
        markdown: DEFAULT_MARKDOWN,
        scenes: initial.scenes,
        segments: initial.segments,
        totalDuration: initial.totalDuration,
        isPlaying: false,
        currentTime: 0,
        showGuide: false,
        playbackSpeed: 1,

        history: { past: [], future: [] },

        aspectRatio: "16:9",
        zoom: 100,

        theme: "default",

        markers: [],

        findText: "",
        replaceText: "",

        setMarkdown: (markdown, addToHistory = true) => {
          const { scenes, segments, totalDuration } = parseAndComputeSegments(markdown)
          const currentMarkdown = get().markdown

          set((state) => ({
            markdown,
            scenes,
            segments,
            totalDuration,
            currentTime: Math.min(state.currentTime, totalDuration),
            history: addToHistory
              ? {
                past: [...state.history.past.slice(-50), currentMarkdown],
                future: [],
              }
              : state.history,
          }))
        },

        undo: () => {
          const { history, markdown } = get()
          if (history.past.length === 0) return

          const previous = history.past[history.past.length - 1]
          const newPast = history.past.slice(0, -1)

          const { scenes, segments, totalDuration } = parseAndComputeSegments(previous)

          set({
            markdown: previous,
            scenes,
            segments,
            totalDuration,
            history: {
              past: newPast,
              future: [markdown, ...get().history.future.slice(0, 50)],
            },
          })
        },

        redo: () => {
          const { history, markdown } = get()
          if (history.future.length === 0) return

          const next = history.future[0]
          const newFuture = history.future.slice(1)

          const { scenes, segments, totalDuration } = parseAndComputeSegments(next)

          set({
            markdown: next,
            scenes,
            segments,
            totalDuration,
            history: {
              past: [...get().history.past, markdown],
              future: newFuture,
            },
          })
        },

        canUndo: () => get().history.past.length > 0,
        canRedo: () => get().history.future.length > 0,

        setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

        setZoom: (zoom) => set({ zoom }),

        setTheme: (theme) => set({ theme }),

        addMarker: (time, label) => {
          const marker: Marker = {
            id: generateId(),
            time,
            label,
            color: "#ec4899",
          }
          set((state) => ({ markers: [...state.markers, marker] }))
        },

        removeMarker: (id) => {
          set((state) => ({ markers: state.markers.filter((m) => m.id !== id) }))
        },

        setFindText: (text) => set({ findText: text }),
        setReplaceText: (text) => set({ replaceText: text }),

        findNext: () => {
          const { markdown, findText } = get()
          if (!findText) return -1
          return markdown.indexOf(findText)
        },

        replaceNext: () => {
          const { markdown, findText, replaceText, setMarkdown } = get()
          if (!findText) return
          const index = markdown.indexOf(findText)
          if (index === -1) return
          const newMarkdown = markdown.slice(0, index) + replaceText + markdown.slice(index + findText.length)
          setMarkdown(newMarkdown)
        },

        replaceAll: () => {
          const { markdown, findText, replaceText, setMarkdown } = get()
          if (!findText) return
          const newMarkdown = markdown.split(findText).join(replaceText)
          setMarkdown(newMarkdown)
        },

        play: () => set({ isPlaying: true }),
        pause: () => set({ isPlaying: false }),
        toggle: () => set((state) => ({ isPlaying: !state.isPlaying })),
        seekTo: (time) => set({ currentTime: Math.max(0, Math.min(time, get().totalDuration)) }),
        toggleGuide: () => set((state) => ({ showGuide: !state.showGuide })),
        setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

        nextFrame: () => {
          const { currentTime, totalDuration } = get()
          set({ currentTime: Math.min(currentTime + 1, totalDuration) })
        },

        prevFrame: () => {
          const { currentTime } = get()
          set({ currentTime: Math.max(currentTime - 1, 0) })
        },

        nextScene: () => {
          const { currentTime, segments, totalDuration } = get()
          const currentSegment = segments.find((s) => currentTime >= s.startTime && currentTime < s.endTime)
          if (currentSegment) {
            const nextTime = currentSegment.endTime
            set({ currentTime: Math.min(nextTime, totalDuration) })
          }
        },

        prevScene: () => {
          const { currentTime, segments } = get()
          const currentIndex = segments.findIndex((s) => currentTime >= s.startTime && currentTime < s.endTime)
          if (currentIndex > 0) {
            set({ currentTime: segments[currentIndex - 1].startTime })
          } else {
            set({ currentTime: 0 })
          }
        },
      }
    },
    {
      name: "markdown-video-storage",
      partialize: (state) => ({
        markdown: state.markdown,
        aspectRatio: state.aspectRatio,
        theme: state.theme,
        markers: state.markers,
      }),
    },
  ),
)
