// Scene types for the markdown-to-video editor

import type {
  AnimationType as SchemaAnimationType,
  AspectRatio as SchemaAspectRatio,
  CalloutArrow,
  CalloutStyle,
  CameraEffect as SchemaCameraEffect,
  ChartType as SchemaChartType,
  CodeFontFamily,
  CodeFontSize,
  CountdownStyle,
  DeviceType as SchemaDeviceType,
  EmojiAnimation,
  ImageFit,
  ImagePosition,
  PanDirection as SchemaPanDirection,
  ParticleIntensity,
  ParticleType as SchemaParticleType,
  PresenterPosition as SchemaPresenterPosition,
  PresenterShape,
  PresenterSize,
  ProgressStyle,
  ShakeIntensity,
  TextFontFamily,
  TextSize,
  TransitionType as SchemaTransitionType,
  ExportFormat as SchemaExportFormat,
} from "./directive-schema.js";

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



// Directive-backed unions are derived from the authoritative schema so the
// runtime scene types cannot drift from parser constants and documentation.
export type TransitionType = SchemaTransitionType;
export type AnimationType = SchemaAnimationType;
export type ParticleType = SchemaParticleType;
export type DeviceType = SchemaDeviceType;
export type ChartType = SchemaChartType;
export type CameraEffect = SchemaCameraEffect;
export type PresenterPosition = SchemaPresenterPosition;
export type PanDirection = SchemaPanDirection;
export type ExportFormat = SchemaExportFormat;
export type AspectRatioType = SchemaAspectRatio;

export type TextAlign = "left" | "center" | "right";

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
  size?: TextSize;
  align?: TextAlign;
  animation?: AnimationType;
  delay?: number;
  color?: string;
  fontFamily?: TextFontFamily;
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
  fontSize?: CodeFontSize; // Font size
  height?: number; // Height in pixels
  width?: number; // Width in pixels
  fontFamily?: CodeFontFamily; // Font family options
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
  arrow?: CalloutArrow;
  style?: CalloutStyle;
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
  shakeIntensity?: ShakeIntensity;
}

export interface SceneCamera {
  effect: CameraEffect;
  value?: number; // zoom level, pan amount
  duration?: number;
  keyframes?: CameraKeyframe[]; // Timeline-based camera control
}

export interface SceneParticles {
  type: ParticleType;
  intensity?: ParticleIntensity;
  duration?: number;
}

export interface ScenePresenter {
  position: PresenterPosition;
  size?: PresenterSize;
  shape?: PresenterShape;
}

export interface Chapter {
  id: string;
  title: string;
  time: number;
}

export interface VideoVariables {
  [key: string]: string;
}

/**
 * Document-level background music declared by `!music`.
 *
 * `src` is deliberately unresolved source text: browser hosts interpret
 * relative paths against the application origin and CLI hosts interpret them
 * relative to the markdown document (or cwd for inline/stdin input). Remote
 * music is HTTPS-only; local paths, data URLs, and browser blob URLs are host
 * capabilities rather than guarantees in every renderer.
 */
export interface MusicTrack {
  src: string;
  /** Linear playback gain in the inclusive range 0-1. */
  volume: number;
  /** Requested fade-in/fade-out duration in seconds. */
  fade: number;
  /** Repeat the source when it is shorter than the video. */
  loop: boolean;
}

export interface SceneImage {
  src: string;
  alt?: string;
  fit?: ImageFit;
  position?: ImagePosition;
}

export interface SceneEmoji {
  emoji: string;
  size?: TextSize;
  animate?: EmojiAnimation;
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
  style?: CountdownStyle;
  color?: string;
}

export interface SceneProgress {
  value: number;
  max?: number;
  animate?: boolean;
  style?: ProgressStyle;
  color?: string;
  label?: string;
}

export interface SourceRange {
  startLine: number; // 1-indexed line number
  endLine: number; // 1-indexed line number (inclusive)
}

export interface SceneSourceMap {
  scene?: SourceRange;
  type?: SourceRange;
  duration?: SourceRange;
  background?: SourceRange;
  transition?: SourceRange;
  chapter?: SourceRange;
  text?: SourceRange;
  code?: SourceRange;
  terminal?: SourceRange;
  chart?: SourceRange;
  mockup?: SourceRange;
  particles?: SourceRange;
  camera?: SourceRange;
  presenter?: SourceRange;
  image?: SourceRange;
  emoji?: SourceRange;
  qr?: SourceRange;
  countdown?: SourceRange;
  progress?: SourceRange;
  diff?: SourceRange;
  callout?: SourceRange;
  layout?: SourceRange;
  locale?: SourceRange;
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
  sourceMap?: SceneSourceMap; // Source line mapping for editor highlighting
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
  /** Burn generated captions into exported frames; off by default. */
  burnCaptions?: boolean;
  locale?: string; // Export in specific language
  fps?: number; // Output FPS (5-60)
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
  music?: MusicTrack; // Document-level background music
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
