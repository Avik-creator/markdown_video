// Store-local editor types. Framework-independent scene, project, export, and
// directive types live in @markdown-video/core; this file intentionally keeps
// only the zustand store contract and UI-specific editor state types.

import type {
  AspectRatio,
  ExportSettings,
  LocalizationStrings,
  MusicTrack,
  Scene,
  SourceRange,
  TimelineSegment,
} from "@markdown-video/core";

export interface HistoryState {
  past: string[];
  future: string[];
}

export type ZoomLevel = 50 | 75 | 100 | 125 | 150;

export type ThemePreset = "default" | "monokai" | "dracula" | "nord" | "github";

export interface Marker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface VideoStore {
  // Core state
  markdown: string;
  setMarkdown: (markdown: string, addToHistory?: boolean) => void;
  scenes: Scene[];
  segments: TimelineSegment[];
  totalDuration: number;
  isPlaying: boolean;
  currentTime: number;
  showGuide: boolean;

  // Localization state. `locales`, `localizationStrings`, and `defaultLocale`
  // are derived from the markdown on every parse (like scenes), never persisted
  // independently. `activeLocale` is the runtime-only user selection; stale or
  // undeclared values are ignored by the display resolver.
  locales: string[];
  localizationStrings: LocalizationStrings;
  defaultLocale?: string;
  /** Document-level !music track derived from markdown on every parse. */
  music?: MusicTrack;
  activeLocale: string | null;
  setActiveLocale: (locale: string | null) => void;

  history: HistoryState;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  zoom: ZoomLevel;
  setZoom: (zoom: ZoomLevel) => void;

  theme: ThemePreset;
  setTheme: (theme: ThemePreset) => void;

  markers: Marker[];
  addMarker: (time: number, label: string) => void;
  removeMarker: (id: string) => void;

  findText: string;
  replaceText: string;
  setFindText: (text: string) => void;
  setReplaceText: (text: string) => void;
  findNext: () => number;
  replaceNext: () => void;
  replaceAll: () => void;

  // Editor highlight (for property-to-code linking)
  highlightRange: SourceRange | null;
  setHighlightRange: (range: SourceRange | null) => void;

  // Playback controls
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (time: number) => void;
  toggleGuide: () => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;

  nextFrame: () => void;
  prevFrame: () => void;
  nextScene: () => void;
  prevScene: () => void;

  // Export settings
  exportSettings: ExportSettings;
  setExportSettings: (settings: Partial<ExportSettings>) => void;
}
