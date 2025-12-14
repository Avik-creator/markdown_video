"use client"

import { useVideoStore } from "@/lib/use-video-store"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, Maximize2, SkipBack, SkipForward } from "lucide-react"
import { useState } from "react"

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const frames = Math.floor((seconds % 1) * 30)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`
}

export function Controls() {
  const isPlaying = useVideoStore((state) => state.isPlaying)
  const currentTime = useVideoStore((state) => state.currentTime)
  const totalDuration = useVideoStore((state) => state.totalDuration)
  const toggle = useVideoStore((state) => state.toggle)
  const seekTo = useVideoStore((state) => state.seekTo)

  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

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
    // Go to previous scene or start
    seekTo(Math.max(0, currentTime - 3))
  }

  const handleSkipForward = () => {
    // Go to next scene or end
    seekTo(Math.min(totalDuration, currentTime + 3))
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-[#0a0a0f] border-t border-white/10">
      {/* Playback controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSkipBack}
          className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/10"
        >
          <SkipBack className="w-4 h-4" />
        </Button>

        <Button variant="ghost" size="icon" onClick={toggle} className="h-10 w-10 text-white hover:bg-white/10">
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleSkipForward}
          className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/10"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>

      {/* Time display */}
      <div className="font-mono text-sm text-white min-w-[140px]">
        <span className="text-white">{formatTime(currentTime)}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{formatTime(totalDuration)}</span>
      </div>

      {/* Volume control */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/10"
        >
          {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
        <Slider
          value={[isMuted ? 0 : volume]}
          onValueChange={([v]) => {
            setVolume(v)
            if (v > 0) setIsMuted(false)
          }}
          max={100}
          step={1}
          className="w-20"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Playback speed */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Speed</span>
        <select
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          className="bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
        >
          <option value={0.5}>0.5x</option>
          <option value={0.75}>0.75x</option>
          <option value={1}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>
      </div>

      {/* Fullscreen */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleFullscreen}
        className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/10"
      >
        <Maximize2 className="w-4 h-4" />
      </Button>
    </div>
  )
}
