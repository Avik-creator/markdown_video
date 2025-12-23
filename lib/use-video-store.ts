import { create } from "zustand";
import { persist } from "zustand/middleware";
import { parseMarkdown, getTimelineSegments } from "./parser";
import type {
  Scene,
  TimelineSegment,
  HistoryState,
  AspectRatio,
  ZoomLevel,
  ThemePreset,
  Marker,
  VideoStore,
  ExportSettings,
  LocalizationStrings,
  SourceRange,
} from "./types";

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
!transition zoom`;

function parseAndComputeSegments(markdown: string) {
  const scenes = parseMarkdown(markdown);
  const { segments, totalDuration } = getTimelineSegments(scenes);
  return { scenes, segments, totalDuration };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const useVideoStore = create<VideoStore>()(
  persist(
    (set, get) => {
      const initial = parseAndComputeSegments(DEFAULT_MARKDOWN);

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
        
        // Editor highlight (for property-to-code linking)
        highlightRange: null,

        exportSettings: {
          resolution: "1080p",
          quality: "high",
          speed: "balanced",
          format: "mp4",
          fps: 30,
          captureWaitTime: 500,
        },

        // Localization
        currentLocale: "en",
        localizationStrings: {},

        setMarkdown: (markdown, addToHistory = true) => {
          const { scenes, segments, totalDuration } =
            parseAndComputeSegments(markdown);
          const currentMarkdown = get().markdown;

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
          }));
        },

        undo: () => {
          const { history, markdown } = get();
          if (history.past.length === 0) return;

          const previous = history.past[history.past.length - 1];
          const newPast = history.past.slice(0, -1);

          const { scenes, segments, totalDuration } =
            parseAndComputeSegments(previous);

          set({
            markdown: previous,
            scenes,
            segments,
            totalDuration,
            history: {
              past: newPast,
              future: [markdown, ...get().history.future.slice(0, 50)],
            },
          });
        },

        redo: () => {
          const { history, markdown } = get();
          if (history.future.length === 0) return;

          const next = history.future[0];
          const newFuture = history.future.slice(1);

          const { scenes, segments, totalDuration } =
            parseAndComputeSegments(next);

          set({
            markdown: next,
            scenes,
            segments,
            totalDuration,
            history: {
              past: [...get().history.past, markdown],
              future: newFuture,
            },
          });
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
          };
          set((state) => ({ markers: [...state.markers, marker] }));
        },

        removeMarker: (id) => {
          set((state) => ({
            markers: state.markers.filter((m) => m.id !== id),
          }));
        },

        setFindText: (text) => set({ findText: text }),
        setReplaceText: (text) => set({ replaceText: text }),

        findNext: () => {
          const { markdown, findText } = get();
          if (!findText) return -1;
          return markdown.indexOf(findText);
        },

        replaceNext: () => {
          const { markdown, findText, replaceText, setMarkdown } = get();
          if (!findText) return;
          const index = markdown.indexOf(findText);
          if (index === -1) return;
          const newMarkdown =
            markdown.slice(0, index) +
            replaceText +
            markdown.slice(index + findText.length);
          setMarkdown(newMarkdown);
        },

        replaceAll: () => {
          const { markdown, findText, replaceText, setMarkdown } = get();
          if (!findText) return;
          const newMarkdown = markdown.split(findText).join(replaceText);
          setMarkdown(newMarkdown);
        },

        setHighlightRange: (range: SourceRange | null) => set({ highlightRange: range }),

        play: () => set({ isPlaying: true }),
        pause: () => set({ isPlaying: false }),
        toggle: () => set((state) => ({ isPlaying: !state.isPlaying })),
        seekTo: (time) =>
          set({
            currentTime: Math.max(0, Math.min(time, get().totalDuration)),
          }),
        toggleGuide: () => set((state) => ({ showGuide: !state.showGuide })),
        setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

        nextFrame: () => {
          const { currentTime, totalDuration } = get();
          set({ currentTime: Math.min(currentTime + 1, totalDuration) });
        },

        prevFrame: () => {
          const { currentTime } = get();
          set({ currentTime: Math.max(currentTime - 1, 0) });
        },

        nextScene: () => {
          const { currentTime, segments, totalDuration } = get();
          const currentSegment = segments.find(
            (s) => currentTime >= s.startTime && currentTime < s.endTime
          );
          if (currentSegment) {
            const nextTime = currentSegment.endTime;
            set({ currentTime: Math.min(nextTime, totalDuration) });
          }
        },

        prevScene: () => {
          const { currentTime, segments } = get();
          const currentIndex = segments.findIndex(
            (s) => currentTime >= s.startTime && currentTime < s.endTime
          );
          if (currentIndex > 0) {
            set({ currentTime: segments[currentIndex - 1].startTime });
          } else {
            set({ currentTime: 0 });
          }
        },

        setExportSettings: (settings) => {
          set((state) => ({
            exportSettings: { ...state.exportSettings, ...settings },
          }));
        },

        // Localization methods
        setCurrentLocale: (locale) => set({ currentLocale: locale }),

        setLocalizationStrings: (strings) =>
          set({ localizationStrings: strings }),

        addLocale: (locale) => {
          // Add locale to all existing strings with empty values
          const { localizationStrings } = get();
          const updated = { ...localizationStrings };
          for (const key of Object.keys(updated)) {
            if (!updated[key][locale]) {
              updated[key][locale] = "";
            }
          }
          set({ localizationStrings: updated });
        },

        removeLocale: (locale) => {
          const { localizationStrings, currentLocale } = get();
          const updated = { ...localizationStrings };
          for (const key of Object.keys(updated)) {
            delete updated[key][locale];
          }
          set({
            localizationStrings: updated,
            currentLocale: currentLocale === locale ? "en" : currentLocale,
          });
        },
      };
    },
    {
      name: "markdown-video-storage",
      partialize: (state) => ({
        markdown: state.markdown,
        aspectRatio: state.aspectRatio,
        theme: state.theme,
        markers: state.markers,
      }),
      onRehydrateStorage: () => (state) => {
        // Re-parse markdown after loading from localStorage to ensure scenes have correct sourceMaps
        if (state?.markdown) {
          const parsed = parseMarkdownFull(state.markdown);
          useVideoStore.setState({
            scenes: parsed.scenes,
            chapters: parsed.chapters,
            totalDuration: parsed.scenes.reduce((acc, s) => acc + s.duration, 0),
          });
        }
      },
    }
  )
);
