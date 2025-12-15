// Scene types for the markdown-to-video editor

export type SceneType =
  | "text"
  | "code"
  | "image"
  | "video"
  | "split"
  | "terminal"
  | "diff"
  | "chart"
  | "mockup"
  | "qr"
  | "countdown"
  | "progress"
  | "emoji";

export type TransitionType =
  | "fade"
  | "slide"
  | "wipe"
  | "zoom"
  | "magic"
  | "none";

export type AnimationType =
  | "fadeIn"
  | "slideUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "bounceIn"
  | "typewriter"
  | "none";

export type TextAlign = "left" | "center" | "right";

export type ParticleType =
  | "confetti"
  | "snow"
  | "rain"
  | "sparkles"
  | "fireworks";

export type DeviceType = "iphone" | "ipad" | "macbook" | "browser" | "android";

export type ChartType = "bar" | "line" | "pie" | "donut";

export type CameraEffect = "zoom" | "pan" | "shake";

export type PresenterPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type PanDirection = "left" | "right" | "up" | "down";

export type ExportFormat = "mp4" | "reels" | "shorts" | "slides" | "gif";

export type AspectRatioType = "16:9" | "9:16" | "1:1" | "4:3";

export interface CodeHighlight {
  lines: number[];
  color?: string;
}

export interface CodeAnnotation {
  line: number;
  text: string;
  position?: "left" | "right";
}

export interface SceneText {
  content: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  align?: TextAlign;
  animation?: AnimationType;
  delay?: number;
  color?: string;
  fontFamily?: "serif" | "sans" | "mono" | "display";
  i18nKey?: string; // Localization key
  stagger?: number; // Stagger delay between lines in seconds
}

export interface SceneCode {
  language: string;
  content: string;
  highlight?: CodeHighlight;
  annotations?: CodeAnnotation[];
  showLineNumbers?: boolean;
  typing?: boolean; // Added typing animation support
  typingSpeed?: number; // Characters per second
  fontSize?: "xs" | "sm" | "md" | "lg"; // Font size
  height?: number; // Height in pixels
  width?: number; // Width in pixels
  fontFamily?:
    | "mono"
    | "jetbrains"
    | "fira"
    | "source"
    | "inconsolata"
    | "courier"; // Font family options
}

export interface SceneTerminal {
  commands: TerminalCommand[];
  typing?: boolean;
  typingSpeed?: number;
}

export interface TerminalCommand {
  prompt?: string; // e.g., "$", ">", or custom
  command: string;
  output?: string;
  delay?: number; // Delay before this command
}

export interface SceneDiff {
  language?: string;
  changes: DiffLine[];
}

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
}

export interface SceneChart {
  type: ChartType;
  data: ChartDataItem[];
  animate?: boolean;
  title?: string;
}

export interface ChartDataItem {
  label: string;
  value: number;
  color?: string;
}

export interface SceneMockup {
  device: DeviceType;
  content: Omit<Scene, "id" | "duration" | "transition" | "mockup">;
}

export interface SceneCallout {
  text: string;
  target?: string; // "line:3" or coordinates
  arrow?: "up" | "down" | "left" | "right";
  style?: "info" | "warning" | "error" | "success";
}

export interface TimelineElement {
  id: string;
  type: "text" | "emoji" | "image" | "code" | "custom";
  content: string;
  at: number; // Start time in seconds
  duration: number; // Duration in seconds
  animation?: AnimationType;
  stagger?: number; // Stagger delay between lines (in seconds)
  delay?: number;
}

export interface CameraKeyframe {
  at: number; // Time in seconds
  zoom?: number; // Zoom level (1 = normal, 1.5 = 150%)
  pan?: PanDirection;
  panAmount?: number; // Pan distance
  shake?: boolean;
  shakeIntensity?: "low" | "medium" | "high";
}

export interface SceneCamera {
  effect: CameraEffect;
  value?: number; // zoom level, pan amount
  duration?: number;
  keyframes?: CameraKeyframe[]; // Timeline-based camera control
}

export interface SceneParticles {
  type: ParticleType;
  intensity?: "low" | "medium" | "high";
  duration?: number;
}

export interface ScenePresenter {
  position: PresenterPosition;
  size?: "sm" | "md" | "lg";
  shape?: "circle" | "square" | "rounded";
}

export interface Chapter {
  id: string;
  title: string;
  time: number;
}

export interface VideoVariables {
  [key: string]: string;
}

export interface SceneImage {
  src: string;
  alt?: string;
  fit?: "cover" | "contain" | "fill";
  position?: "center" | "top" | "bottom" | "left" | "right";
}

export interface SceneEmoji {
  emoji: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  animate?: "bounce" | "spin" | "pulse" | "shake" | "none";
}

export interface SceneQR {
  url: string;
  size?: number;
  color?: string;
  bgColor?: string;
  label?: string;
}

export interface SceneCountdown {
  from: number;
  style?: "digital" | "circle" | "minimal";
  color?: string;
}

export interface SceneProgress {
  value: number;
  max?: number;
  animate?: boolean;
  style?: "bar" | "circle" | "semicircle";
  color?: string;
  label?: string;
}

export interface Scene {
  id: string;
  type: SceneType;
  duration: number;
  transition?: TransitionType;
  transitionDuration?: number;
  background?: string;
  text?: SceneText;
  code?: SceneCode;
  image?: SceneImage;
  split?: {
    left: Omit<Scene, "id" | "duration" | "transition">;
    right: Omit<Scene, "id" | "duration" | "transition">;
    ratio?: number;
    direction?: "horizontal" | "vertical";
  };
  terminal?: SceneTerminal;
  diff?: SceneDiff;
  chart?: SceneChart;
  mockup?: SceneMockup;
  callout?: SceneCallout;
  camera?: SceneCamera;
  particles?: SceneParticles;
  presenter?: ScenePresenter;
  chapter?: string;
  emoji?: SceneEmoji;
  qr?: SceneQR;
  countdown?: SceneCountdown;
  progress?: SceneProgress;
  timelineElements?: TimelineElement[]; // In-scene timeline elements
  locale?: string; // Scene-specific locale override
}

export interface LocalizationStrings {
  [key: string]: {
    [locale: string]: string;
  };
}

export interface ExportSettings {
  resolution: string;
  quality: string;
  speed: string;
  format?: ExportFormat;
  aspectRatio?: AspectRatioType;
  safeArea?: boolean; // For reels/shorts
  includeSubtitles?: boolean;
  locale?: string; // Export in specific language
  fps?: number; // Output FPS (5-60)
  captureWaitTime?: number; // Wait time between captures in ms (50-1000)
}

export interface VideoProject {
  scenes: Scene[];
  totalDuration: number;
  currentTime: number;
  isPlaying: boolean;
  currentSceneIndex: number;
  chapters: Chapter[]; // Added chapters
  variables: VideoVariables; // Added variables
  locales?: string[]; // Supported locales (e.g., ["en", "es", "fr"])
  localizationStrings?: LocalizationStrings; // i18n strings
  defaultLocale?: string; // Default locale
  exportSettings?: ExportSettings; // Export configuration
}

export interface TimelineSegment {
  sceneId: string;
  startTime: number;
  endTime: number;
  duration: number;
  color: string;
  label: string;
  chapter?: string; // Added chapter marker
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: "intro" | "tutorial" | "demo" | "outro" | "custom";
  thumbnail?: string;
  markdown: string;
}

// Video store types
export interface HistoryState {
  past: string[];
  future: string[];
}

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3";

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

  // Localization
  currentLocale: string;
  setCurrentLocale: (locale: string) => void;
  localizationStrings: LocalizationStrings;
  setLocalizationStrings: (strings: LocalizationStrings) => void;
  addLocale: (locale: string) => void;
  removeLocale: (locale: string) => void;
}
