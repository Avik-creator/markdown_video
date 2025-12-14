"use client"

import { useVideoStore } from "@/lib/use-video-store"
import { useEffect, useRef } from "react"
import { Play, Pause, SkipBack, SkipForward } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function Controls() {
  const isPlaying = useVideoStore((state) => state.isPlaying)
  const currentTime = useVideoStore((state) => state.currentTime)
  const totalDuration = useVideoStore((state) => state.totalDuration)
  const toggle = useVideoStore((state) => state.toggle)
  const seekTo = useVideoStore((state) => state.seekTo)
  const playbackSpeed = useVideoStore((state) => state.playbackSpeed)
  const setPlaybackSpeed = useVideoStore((state) => state.setPlaybackSpeed)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        const store = useVideoStore.getState()
        const newTime = store.currentTime + 0.033 * playbackSpeed

        if (newTime >= store.totalDuration) {
          store.seekTo(0)
          store.pause()
        } else {
          store.seekTo(newTime)
        }
      }, 33)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, playbackSpeed])

  const handleSkipBack = () => {
    seekTo(Math.max(0, currentTime - 3))
  }

  const handleSkipForward = () => {
    seekTo(Math.min(totalDuration, currentTime + 3))
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-neutral-950 border-t border-gray-200 dark:border-neutral-800">
      {/* Playback controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleSkipBack}
          className={cn(
            "h-8 w-8 flex items-center justify-center text-gray-600 dark:text-neutral-400",
            "hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors"
          )}
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={toggle}
          className={cn(
            "h-10 w-10 flex items-center justify-center text-gray-900 dark:text-neutral-100",
            "hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors"
          )}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>

        <button
          onClick={handleSkipForward}
          className={cn(
            "h-8 w-8 flex items-center justify-center text-gray-600 dark:text-neutral-400",
            "hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors"
          )}
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Time display */}
      <div className="font-mono text-sm text-gray-900 dark:text-neutral-100 min-w-[100px]">
        <span>{formatTime(currentTime)}</span>
        <span className="text-gray-500 dark:text-neutral-500">/</span>
        <span className="text-gray-500 dark:text-neutral-500">{formatTime(totalDuration)}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Playback speed */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 dark:text-neutral-400">Speed</span>
        <select
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          className={cn(
            "bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 text-xs rounded px-2 py-1",
            "border border-gray-300 dark:border-neutral-700",
            "focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-neutral-600"
          )}
        >
          <option value={0.5}>0.5x</option>
          <option value={0.75}>0.75x</option>
          <option value={1}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>
      </div>
    </div>
  )
}
