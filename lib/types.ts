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

export type TransitionType = "fade" | "slide" | "wipe" | "zoom" | "magic" | "none"

export type AnimationType =
  | "fadeIn"
  | "slideUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "bounceIn"
  | "typewriter"
  | "none"

export type TextAlign = "left" | "center" | "right"

export type ParticleType = "confetti" | "snow" | "rain" | "sparkles" | "fireworks"

export type DeviceType = "iphone" | "ipad" | "macbook" | "browser" | "android"

export type ChartType = "bar" | "line" | "pie" | "donut"

export type CameraEffect = "zoom" | "pan" | "shake"

export type PresenterPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export interface CodeHighlight {
  lines: number[]
  color?: string
}

export interface CodeAnnotation {
  line: number
  text: string
  position?: "left" | "right"
}

export interface SceneText {
  content: string
  size?: "sm" | "md" | "lg" | "xl" | "2xl"
  align?: TextAlign
  animation?: AnimationType
  delay?: number
}

export interface SceneCode {
  language: string
  content: string
  highlight?: CodeHighlight
  annotations?: CodeAnnotation[]
  showLineNumbers?: boolean
  typing?: boolean // Added typing animation support
  typingSpeed?: number // Characters per second
}

export interface SceneTerminal {
  commands: TerminalCommand[]
  typing?: boolean
  typingSpeed?: number
}

export interface TerminalCommand {
  prompt?: string // e.g., "$", ">", or custom
  command: string
  output?: string
  delay?: number // Delay before this command
}

export interface SceneDiff {
  language?: string
  changes: DiffLine[]
}

export interface DiffLine {
  type: "add" | "remove" | "context"
  content: string
}

export interface SceneChart {
  type: ChartType
  data: ChartDataItem[]
  animate?: boolean
  title?: string
}

export interface ChartDataItem {
  label: string
  value: number
  color?: string
}

export interface SceneMockup {
  device: DeviceType
  content: Omit<Scene, "id" | "duration" | "transition" | "mockup">
}

export interface SceneCallout {
  text: string
  target?: string // "line:3" or coordinates
  arrow?: "up" | "down" | "left" | "right"
  style?: "info" | "warning" | "error" | "success"
}

export interface SceneCamera {
  effect: CameraEffect
  value?: number // zoom level, pan amount
  duration?: number
}

export interface SceneParticles {
  type: ParticleType
  intensity?: "low" | "medium" | "high"
  duration?: number
}

export interface ScenePresenter {
  position: PresenterPosition
  size?: "sm" | "md" | "lg"
  shape?: "circle" | "square" | "rounded"
}

export interface Chapter {
  id: string
  title: string
  time: number
}

export interface VideoVariables {
  [key: string]: string
}

export interface SceneImage {
  src: string
  alt?: string
  fit?: "cover" | "contain" | "fill"
  position?: "center" | "top" | "bottom" | "left" | "right"
}

export interface SceneEmoji {
  emoji: string
  size?: "sm" | "md" | "lg" | "xl" | "2xl"
  animate?: "bounce" | "spin" | "pulse" | "shake" | "none"
}

export interface SceneQR {
  url: string
  size?: number
  color?: string
  bgColor?: string
  label?: string
}

export interface SceneCountdown {
  from: number
  style?: "digital" | "circle" | "minimal"
  color?: string
}

export interface SceneProgress {
  value: number
  max?: number
  animate?: boolean
  style?: "bar" | "circle" | "semicircle"
  color?: string
  label?: string
}

export interface Scene {
  id: string
  type: SceneType
  duration: number
  transition?: TransitionType
  transitionDuration?: number
  background?: string
  text?: SceneText
  code?: SceneCode
  image?: SceneImage
  split?: {
    left: Omit<Scene, "id" | "duration" | "transition">
    right: Omit<Scene, "id" | "duration" | "transition">
    ratio?: number
    direction?: "horizontal" | "vertical"
  }
  terminal?: SceneTerminal
  diff?: SceneDiff
  chart?: SceneChart
  mockup?: SceneMockup
  callout?: SceneCallout
  camera?: SceneCamera
  particles?: SceneParticles
  presenter?: ScenePresenter
  chapter?: string
  emoji?: SceneEmoji
  qr?: SceneQR
  countdown?: SceneCountdown
  progress?: SceneProgress
}

export interface VideoProject {
  scenes: Scene[]
  totalDuration: number
  currentTime: number
  isPlaying: boolean
  currentSceneIndex: number
  chapters: Chapter[] // Added chapters
  variables: VideoVariables // Added variables
}

export interface TimelineSegment {
  sceneId: string
  startTime: number
  endTime: number
  duration: number
  color: string
  label: string
  chapter?: string // Added chapter marker
}

export interface Template {
  id: string
  name: string
  description: string
  category: "intro" | "tutorial" | "demo" | "outro" | "custom"
  thumbnail?: string
  markdown: string
}
