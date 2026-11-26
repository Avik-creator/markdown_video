// Video editor constants

export const ASPECT_RATIOS = {
  "16:9": { label: "16:9 (YouTube)", width: 16, height: 9 },
  "9:16": { label: "9:16 (TikTok)", width: 9, height: 16 },
  "1:1": { label: "1:1 (Instagram)", width: 1, height: 1 },
  "4:3": { label: "4:3 (Classic)", width: 4, height: 3 },
} as const

export const ZOOM_LEVELS = [50, 75, 100, 125, 150] as const
