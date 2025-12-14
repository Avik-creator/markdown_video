// Timeline utilities

import type { Scene } from "../types"
import { SCENE_COLORS } from "./constants"

export function getTimelineSegments(scenes: Scene[]): {
  segments: {
    sceneId: string
    startTime: number
    endTime: number
    duration: number
    color: string
    label: string
    chapter?: string
  }[]
  totalDuration: number
} {
  const segments: {
    sceneId: string
    startTime: number
    endTime: number
    duration: number
    color: string
    label: string
    chapter?: string
  }[] = []
  let currentTime = 0

  scenes.forEach((scene, index) => {
    segments.push({
      sceneId: scene.id,
      startTime: currentTime,
      endTime: currentTime + scene.duration,
      duration: scene.duration,
      color: scene.background || SCENE_COLORS[index % SCENE_COLORS.length],
      label: `${scene.duration}s`,
      chapter: scene.chapter,
    })
    currentTime += scene.duration
  })

  return { segments, totalDuration: currentTime }
}

export function getSceneAtTime(
  scenes: Scene[],
  time: number,
): { scene: Scene; index: number; sceneTime: number } | null {
  let currentTime = 0

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    if (time >= currentTime && time < currentTime + scene.duration) {
      return {
        scene,
        index: i,
        sceneTime: time - currentTime,
      }
    }
    currentTime += scene.duration
  }

  if (scenes.length > 0) {
    const lastScene = scenes[scenes.length - 1]
    return {
      scene: lastScene,
      index: scenes.length - 1,
      sceneTime: lastScene.duration,
    }
  }

  return null
}
