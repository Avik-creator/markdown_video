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

const SHORT_SIDE: Record<string, number> = {
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
  "1440p": 1440,
  "4k": 2160,
}

const ASPECT: Record<string, [number, number]> = {
  "16:9": [16, 9],
  "9:16": [9, 16],
  "1:1": [1, 1],
  "4:3": [4, 3],
}

// libx264 with yuv420p needs even dimensions.
const even = (n: number) => Math.round(n / 2) * 2

/**
 * Output size for a resolution preset and the project's aspect ratio.
 * The preset names the short side, so "1080p" is 1920x1080 at 16:9 and 1080x1920 at 9:16.
 */
export function getExportDimensions(resolution: string, aspectRatio: string = "16:9") {
  const short = SHORT_SIDE[resolution] ?? 1080
  const [w, h] = ASPECT[aspectRatio] ?? ASPECT["16:9"]
  return w >= h
    ? { width: even((short * w) / h), height: even(short) }
    : { width: even(short), height: even((short * h) / w) }
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

export function estimatedTime(totalDuration: number, fps: string, quality: string) {
  const frameRate = Number.parseInt(fps)
  const qualitySettings = getQualitySettings(quality)
  const frames = Math.ceil((totalDuration * frameRate) / qualitySettings.captureInterval)
  const msPerFrame = quality === "fast" ? 60 : quality === "balanced" ? 40 : 50
  const seconds = Math.ceil((frames * msPerFrame) / 1000)
  if (seconds < 60) return `~${seconds}s`
  return `~${Math.ceil(seconds / 60)}m`
}
