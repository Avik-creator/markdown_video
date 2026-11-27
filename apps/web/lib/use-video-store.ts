import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import {
  applyDirectiveValueEdit,
  parseMarkdownFull,
  getTimelineSegments,
} from "@markdown-video/core";
import { DEFAULT_MARKDOWN } from "./default-markdown";
import type { AspectRatio, SourceRange } from "@markdown-video/core";
import type { Marker, ThemePreset, VideoStore } from "./types";

// Runtime-only markdown mutation metadata. The CodeMirror editor bridge uses
// this to tell its own commits apart from external mutations (undo/redo,
// project open, find/replace) without comparing document text alone. These
// fields are never persisted: `partializeState` only picks document keys.
declare module "./types" {
  interface VideoStore {
    /** Monotonic counter bumped on every markdown mutation. Runtime-only. */
    markdownRevision: number;
    /**
     * Origin tag of the most recent markdown mutation: "editor" for live
     * typing commits, "undo"/"redo" for history navigation, or null for
     * untagged external mutations. Runtime-only.
     */
    markdownOrigin: string | null;
  }
}

// One-shot origin tag consumed by the next setMarkdown call. Keeping this
// side-channel module-scoped (instead of widening the setMarkdown signature)
// is what makes the metadata backwards-compatible: every existing caller of
// setMarkdown/undo/redo keeps working unchanged.
let pendingMarkdownOrigin: string | null = null;

/**
 * Tag the next markdown mutation with an origin. The tag applies to exactly
 * one setMarkdown call and is then cleared, so callers must set it immediately
 * before committing in the same synchronous tick.
 */
export function tagNextMarkdownOrigin(origin: string): void {
  pendingMarkdownOrigin = origin;
}


function parseAndComputeSegments(markdown: string) {
  const parsed = parseMarkdownFull(markdown);
  const { segments, totalDuration } = getTimelineSegments(parsed.scenes);
  return {
    scenes: parsed.scenes,
    segments,
    totalDuration,
    locales: parsed.locales,
    localizationStrings: parsed.localizationStrings,
    defaultLocale: parsed.defaultLocale,
    music: parsed.music,
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/** Frame rate used for frame stepping when the project doesn't configure one. */
export const DEFAULT_FRAME_RATE = 30;

/**
 * Duration of a single frame in seconds for the given frame rate.
 * Falls back to {@link DEFAULT_FRAME_RATE} when the frame rate is missing
 * or not a positive finite number.
 */
export function getFrameDuration(fps?: number | null): number {
  if (typeof fps === "number" && Number.isFinite(fps) && fps > 0) {
    return 1 / fps;
  }
  return 1 / DEFAULT_FRAME_RATE;
}

export interface PlaybackAdvance {
  time: number;
  reachedEnd: boolean;
}

/**
 * Pure clock-delta playback advance.
 *
 * `deltaSeconds` is the real elapsed time since the previous frame (measured
 * with a clock such as `performance.now()`), so playback speed tracks wall
 * time instead of assuming a fixed step per timer tick.
 */
export function advancePlaybackTime(
  currentTime: number,
  deltaSeconds: number,
  playbackSpeed: number,
  totalDuration: number,
): PlaybackAdvance {
  const newTime = currentTime + deltaSeconds * playbackSpeed;
  if (newTime >= totalDuration) {
    return { time: totalDuration, reachedEnd: true };
  }
  return { time: Math.max(0, newTime), reachedEnd: false };
}

/** The subset of the store written to localStorage. */
interface PersistedProjectState {
  markdown: string;
  aspectRatio: AspectRatio;
  theme: ThemePreset;
  markers: Marker[];
}

function partializeState(state: VideoStore): PersistedProjectState {
  return {
    markdown: state.markdown,
    aspectRatio: state.aspectRatio,
    theme: state.theme,
    markers: state.markers,
  };
}

/**
 * JSON storage that skips the localStorage write when the partialized state
 * is unchanged. zustand's persist middleware calls `setItem` on *every* store
 * update — including playback ticks at 30-60fps — so without this the same
 * payload would be serialized and written dozens of times per second.
 *
 * The partialized values are immutable snapshots (strings, arrays replaced
 * rather than mutated), so reference equality per key means the serialized
 * payload would be identical and the write can be skipped safely.
 */
function createDedupedJSONStorage():
  | PersistStorage<PersistedProjectState>
  | undefined {
  const jsonStorage = createJSONStorage<PersistedProjectState>(
    () => localStorage,
  );
  if (!jsonStorage) return undefined;

  let lastWrittenState: Record<string, unknown> | null = null;

  return {
    getItem: jsonStorage.getItem,
    removeItem: jsonStorage.removeItem,
    setItem: (name: string, value: StorageValue<PersistedProjectState>) => {
      const state: unknown = value.state;
      if (state !== null && typeof state === "object") {
        const record = state as Record<string, unknown>;
        const previous = lastWrittenState;
        if (previous !== null) {
          const keys = Object.keys(record);
          const unchanged =
            keys.length === Object.keys(previous).length &&
            keys.every((key) => Object.is(record[key], previous[key]));
          if (unchanged) return;
        }
        lastWrittenState = { ...record };
      } else {
        lastWrittenState = null;
      }
      return jsonStorage.setItem(name, value);
    },
  };
}

const storage = createDedupedJSONStorage();

export const useVideoStore = create<VideoStore>()(
  persist(
    (set, get) => {
      const initial = parseAndComputeSegments(DEFAULT_MARKDOWN);

      return {
        markdown: DEFAULT_MARKDOWN,
        markdownRevision: 0,
        markdownOrigin: null,
        scenes: initial.scenes,
        segments: initial.segments,
        totalDuration: initial.totalDuration,
        locales: initial.locales,
        localizationStrings: initial.localizationStrings,
        defaultLocale: initial.defaultLocale,
        music: initial.music,
        activeLocale: null,
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
        },

        setMarkdown: (markdown, addToHistory = true) => {
          // The origin tag is consumed by exactly one setMarkdown call —
          // including a no-op one — so it can never leak onto a later,
          // unrelated mutation.
          const origin = pendingMarkdownOrigin;
          pendingMarkdownOrigin = null;

          const currentMarkdown = get().markdown;
          if (markdown === currentMarkdown) {
            // Identical-text writes must not push a duplicate history entry
            // or clear the redo future: a zero-replacement Replace All (or
            // any other no-op write) would otherwise destroy redo after an
            // undo. The reparse is skipped as well — every write path
            // (setMarkdown/undo/redo/rehydration) recomputes derived state
            // synchronously, so identical text implies scenes, segments and
            // totalDuration are already in sync, and nothing consumes
            // markdownRevision outside tests, so no flow can rely on a
            // revision bump for unchanged text.
            return;
          }

          const {
            scenes,
            segments,
            totalDuration,
            locales,
            localizationStrings,
            defaultLocale,
            music,
          } = parseAndComputeSegments(markdown);

          set((state) => ({
            markdown,
            markdownRevision: state.markdownRevision + 1,
            markdownOrigin: origin,
            scenes,
            segments,
            totalDuration,
            locales,
            localizationStrings,
            defaultLocale,
            music,
            currentTime: Math.min(state.currentTime, totalDuration),
            history: addToHistory
              ? {
                  past: [...state.history.past.slice(-50), currentMarkdown],
                  future: [],
                }
              : state.history,
          }));
        },

        applyDirectiveEdit: (edit) => {
          const result = applyDirectiveValueEdit(get().markdown, edit);
          // The pure engine owns all safety/validation decisions. The store's
          // job is only to commit successful non-noop text synchronously so
          // preview, timeline, and panel all observe the edit in the same
          // state update (and so undo gets exactly one document entry).
          if (result.ok && result.action !== "noop") {
            get().setMarkdown(result.markdown);
          }
          return result;
        },

        undo: () => {
          const { history, markdown } = get();
          if (history.past.length === 0) return;

          const previous = history.past[history.past.length - 1];
          const newPast = history.past.slice(0, -1);

          const parsed = parseAndComputeSegments(previous);

          set({
            markdown: previous,
            markdownRevision: get().markdownRevision + 1,
            markdownOrigin: "undo",
            scenes: parsed.scenes,
            segments: parsed.segments,
            totalDuration: parsed.totalDuration,
            locales: parsed.locales,
            localizationStrings: parsed.localizationStrings,
            defaultLocale: parsed.defaultLocale,
            music: parsed.music,
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

          const parsed = parseAndComputeSegments(next);

          set({
            markdown: next,
            markdownRevision: get().markdownRevision + 1,
            markdownOrigin: "redo",
            scenes: parsed.scenes,
            segments: parsed.segments,
            totalDuration: parsed.totalDuration,
            locales: parsed.locales,
            localizationStrings: parsed.localizationStrings,
            defaultLocale: parsed.defaultLocale,
            music: parsed.music,
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

        // Runtime-only preference. We deliberately do not persist it: the
        // document owns the available/default locales, and a stale persisted
        // preference would otherwise be surprising when opening a different or
        // edited document. Resolution validates it against the current
        // document's declared locales before use.
        setActiveLocale: (locale) => set({ activeLocale: locale }),

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
          const { currentTime, totalDuration, exportSettings } = get();
          const frameDuration = getFrameDuration(exportSettings.fps);
          set({
            currentTime: Math.min(currentTime + frameDuration, totalDuration),
          });
        },

        prevFrame: () => {
          const { currentTime, exportSettings } = get();
          const frameDuration = getFrameDuration(exportSettings.fps);
          set({ currentTime: Math.max(currentTime - frameDuration, 0) });
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
      };
    },
    {
      name: "markdown-video-storage",
      ...(storage ? { storage } : {}),
      partialize: partializeState,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PersistedProjectState>;
        // Rehydrate only the keys owned by `partializeState`. Spreading the
        // whole persisted payload would resurrect stale or hand-edited keys
        // for playback state, runtime-only markdown metadata, and removed UI
        // state that were never meant to be part of a new session.
        const merged: VideoStore = {
          ...currentState,
          currentTime: currentState.currentTime,
          isPlaying: false,
        };

        if (typeof persisted.markdown === "string") {
          merged.markdown = persisted.markdown;
        }
        if (persisted.aspectRatio !== undefined) {
          merged.aspectRatio = persisted.aspectRatio;
        }
        if (persisted.theme !== undefined) {
          merged.theme = persisted.theme;
        }
        if (Array.isArray(persisted.markers)) {
          merged.markers = persisted.markers;
        }

        // Re-parse the persisted markdown so derived state (scenes, segments,
        // totalDuration, localization tables, source maps) matches the restored
        // document instead of the default document the store initialized with.
        if (typeof persisted.markdown === "string") {
          const parsed = parseAndComputeSegments(persisted.markdown);
          merged.scenes = parsed.scenes;
          merged.segments = parsed.segments;
          merged.totalDuration = parsed.totalDuration;
          merged.locales = parsed.locales;
          merged.localizationStrings = parsed.localizationStrings;
          merged.defaultLocale = parsed.defaultLocale;
          merged.music = parsed.music;
          merged.currentTime = Math.min(
            merged.currentTime,
            parsed.totalDuration,
          );
        }
        return merged;
      },
    }
  )
);
