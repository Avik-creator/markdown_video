// Export utility functions

export interface ExportPreset {
  id: string
  name: string
  format: string
  resolution: string
  fps: string
  quality: string
}

export interface QualitySettings {
  scale: number
  captureInterval: number
  bitrate: number
  waitTime: number
}

const STORAGE_KEY = "markdown-video-export-presets"

export function loadPresets(): ExportPreset[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function savePresets(presets: ExportPreset[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function getResolutionDimensions(res: string) {
  switch (res) {
    case "720p":
      return { width: 1280, height: 720 }
    case "1080p":
      return { width: 1920, height: 1080 }
    case "1440p":
      return { width: 2560, height: 1440 }
    case "4k":
      return { width: 3840, height: 2160 }
    default:
      return { width: 1920, height: 1080 }
  }
}

export function getQualitySettings(q: string): QualitySettings {
  switch (q) {
    case "fast":
      return {
        scale: 2, // Capture at 2x for crisp rendering
        captureInterval: 2, // Capture every 2nd frame
        bitrate: 12000000, // 12 Mbps
        waitTime: 50,
      }
    case "balanced":
      return {
        scale: 2, // Capture at 2x
        captureInterval: 1, // Capture every frame
        bitrate: 20000000, // 20 Mbps
        waitTime: 16,
      }
    case "quality":
      return {
        scale: 3, // Capture at 3x for ultra crisp
        captureInterval: 1, // Every frame
        bitrate: 40000000, // 40 Mbps for smooth gradients
        waitTime: 16,
      }
    default:
      return { scale: 2, captureInterval: 1, bitrate: 20000000, waitTime: 16 }
  }
}

export function getMimeType(fmt: string) {
  if (fmt === "webm") {
    // Prefer VP9 for better quality
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
      return "video/webm;codecs=vp9,opus"
    }
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
      return "video/webm;codecs=vp9"
    }
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
      return "video/webm;codecs=vp8"
    }
    return "video/webm"
  }
  return "video/webm"
}

export function estimatedTime(totalDuration: number, fps: string, quality: string) {
  const frameRate = Number.parseInt(fps)
  const qualitySettings = getQualitySettings(quality)
  const frames = Math.ceil((totalDuration * frameRate) / qualitySettings.captureInterval)
  const msPerFrame = quality === "fast" ? 60 : quality === "balanced" ? 40 : 50
  const seconds = Math.ceil((frames * msPerFrame) / 1000)
  if (seconds < 60) return `~${seconds}s`
  return `~${Math.ceil(seconds / 60)}m`
}
