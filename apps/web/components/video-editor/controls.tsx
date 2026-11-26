"use client"

import { advancePlaybackTime, useVideoStore } from "@/lib/use-video-store"
import { useEffect } from "react"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { LocalePicker } from "./scene-preview/components/LocalePicker"
import { usePreviewMusic } from "./use-preview-music"

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

/**
 * Largest wall-clock gap applied in a single frame. Tabs stop firing
 * requestAnimationFrame while hidden, so without a cap the first frame after
 * returning would jump playback forward by the entire hidden interval.
 */
const MAX_FRAME_DELTA_SECONDS = 0.25

export function Controls() {
  const isPlaying = useVideoStore((state) => state.isPlaying)
  const currentTime = useVideoStore((state) => state.currentTime)
  const totalDuration = useVideoStore((state) => state.totalDuration)
  const toggle = useVideoStore((state) => state.toggle)
  const seekTo = useVideoStore((state) => state.seekTo)
  const playbackSpeed = useVideoStore((state) => state.playbackSpeed)
  const setPlaybackSpeed = useVideoStore((state) => state.setPlaybackSpeed)
  const {
    hasMusic: hasPreviewMusic,
    isMuted: isPreviewMusicMuted,
    toggleMuted: togglePreviewMusicMuted,
  } = usePreviewMusic()

  useEffect(() => {
    if (!isPlaying) return

    let rafId = 0
    let lastTimestamp: number | null = null

    const tick = (timestamp: number) => {
      if (lastTimestamp === null) {
        // First frame only establishes the clock baseline.
        lastTimestamp = timestamp
        rafId = requestAnimationFrame(tick)
        return
      }

      const elapsedSeconds = Math.max(
        0,
        Math.min((timestamp - lastTimestamp) / 1000, MAX_FRAME_DELTA_SECONDS)
      )
      lastTimestamp = timestamp

      const store = useVideoStore.getState()
      const result = advancePlaybackTime(
        store.currentTime,
        elapsedSeconds,
        store.playbackSpeed,
        store.totalDuration
      )

      if (result.reachedEnd) {
        store.seekTo(0)
        store.pause()
        return
      }

      store.seekTo(result.time)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [isPlaying])

  const handleSkipBack = () => {
    seekTo(Math.max(0, currentTime - 3))
  }

  const handleSkipForward = () => {
    seekTo(Math.min(totalDuration, currentTime + 3))
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 bg-white dark:bg-neutral-950 border-t border-gray-200 dark:border-neutral-800">
      {/* Playback controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleSkipBack}
          aria-label="Skip back 3 seconds"
          title="Skip back 3 seconds"
          className={cn(
            "h-8 w-8 flex items-center justify-center text-gray-600 dark:text-neutral-400",
            "hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors"
          )}
        >
          <SkipBack className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
          className={cn(
            "h-10 w-10 flex items-center justify-center text-gray-900 dark:text-neutral-100",
            "hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors"
          )}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Play className="w-5 h-5" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={handleSkipForward}
          aria-label="Skip forward 3 seconds"
          title="Skip forward 3 seconds"
          className={cn(
            "h-8 w-8 flex items-center justify-center text-gray-600 dark:text-neutral-400",
            "hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors"
          )}
        >
          <SkipForward className="w-4 h-4" aria-hidden="true" />
        </button>

        {hasPreviewMusic && (
          <button
            type="button"
            onClick={togglePreviewMusicMuted}
            aria-label={isPreviewMusicMuted ? "Unmute preview music" : "Mute preview music"}
            aria-pressed={isPreviewMusicMuted}
            title={isPreviewMusicMuted ? "Unmute preview music" : "Mute preview music"}
            className={cn(
              "h-8 w-8 flex items-center justify-center",
              "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100",
              "hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors"
            )}
          >
            {isPreviewMusicMuted ? (
              <VolumeX className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Time display */}
      <div className="font-mono text-sm text-gray-900 dark:text-neutral-100 min-w-[100px]">
        <span>{formatTime(currentTime)}</span>
        <span className="text-gray-500 dark:text-neutral-500">/</span>
        <span className="text-gray-500 dark:text-neutral-500">{formatTime(totalDuration)}</span>
      </div>

      {/* Playback speed */}
      <div className="ml-auto flex items-center gap-2">
        <LocalePicker />
        <span className="text-xs text-gray-600 dark:text-neutral-400">Speed</span>
        <select
          aria-label="Playback speed"
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
