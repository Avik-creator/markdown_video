"use client"

import type React from "react"
import { useVideoStore } from "@/lib/use-video-store"
import { useEffect, useRef, useState, useCallback } from "react"
import {
  Bookmark,
  GripVertical,
  Trash2,
  Type,
  Code,
  Terminal,
  BarChart3,
  Smartphone,
  ImageIcon,
  Hash,
} from "lucide-react"
import { motion, Reorder, useDragControls } from "framer-motion"
import { cn } from "@/lib/utils"

const sceneTypeIcons: Record<string, React.ReactNode> = {
  text: <Type className="w-3 h-3" />,
  code: <Code className="w-3 h-3" />,
  terminal: <Terminal className="w-3 h-3" />,
  chart: <BarChart3 className="w-3 h-3" />,
  mockup: <Smartphone className="w-3 h-3" />,
  image: <ImageIcon className="w-3 h-3" />,
  qr: <Hash className="w-3 h-3" />,
}

interface TimelineSegmentProps {
  segment: {
    sceneId: string
    startTime: number
    endTime: number
    duration: number
    color: string
    label: string
    chapter?: string
  }
  scene: {
    id: string
    type: string
    text?: { content: string }
  }
  isActive: boolean
  widthPercent: number
  onClick: () => void
}

function TimelineSegment({ segment, scene, isActive, widthPercent, onClick }: TimelineSegmentProps) {
  const dragControls = useDragControls()

  const getPreviewText = () => {
    if (scene.text?.content) {
      return scene.text.content.slice(0, 20) + (scene.text.content.length > 20 ? "..." : "")
    }
    return scene.type.charAt(0).toUpperCase() + scene.type.slice(1)
  }

  return (
    <Reorder.Item
      value={segment}
      dragListener={false}
      dragControls={dragControls}
      className={cn(
        "relative h-full flex items-center justify-center text-white text-sm font-medium border-r border-black/30 last:border-r-0 transition-all cursor-pointer group",
        isActive && "ring-2 ring-white ring-inset",
      )}
      style={{
        width: `${widthPercent}%`,
        backgroundColor: segment.color,
        opacity: isActive ? 1 : 0.8,
      }}
      onClick={onClick}
      whileHover={{ opacity: 1 }}
    >
      {/* Drag handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing bg-black/20"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <GripVertical className="w-3 h-3" />
      </div>

      {/* Scene type icon */}
      <div className="absolute top-1 left-7 opacity-60">
        {sceneTypeIcons[scene.type] || <Type className="w-3 h-3" />}
      </div>

      {/* Chapter marker */}
      {segment.chapter && (
        <div className="absolute top-1 right-1">
          <Bookmark className="w-3 h-3 text-white/80" />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col items-center gap-0.5 px-2">
        <span className="text-xs font-mono opacity-90">{segment.label}</span>
        {widthPercent > 8 && <span className="text-[10px] opacity-60 truncate max-w-full">{getPreviewText()}</span>}
      </div>

      {/* Resize handles */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/30 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/50" />
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/30 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/50" />
    </Reorder.Item>
  )
}

export function Timeline() {
  const scenes = useVideoStore((state) => state.scenes)
  const segments = useVideoStore((state) => state.segments)
  const totalDuration = useVideoStore((state) => state.totalDuration)
  const currentTime = useVideoStore((state) => state.currentTime)
  const seekTo = useVideoStore((state) => state.seekTo)
  const markers = useVideoStore((state) => state.markers)
  const removeMarker = useVideoStore((state) => state.removeMarker)

  const timelineRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const [orderedSegments, setOrderedSegments] = useState(segments)

  useEffect(() => {
    setOrderedSegments(segments)
  }, [segments])

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || totalDuration === 0) return

      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = x / rect.width
      const newTime = percentage * totalDuration
      seekTo(newTime)
    },
    [totalDuration, seekTo],
  )

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true
    handleTimelineClick(e)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !timelineRef.current) return
    handleTimelineClick(e)
  }

  const handleMouseUp = () => {
    isDragging.current = false
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDragging.current = false
    }
    window.addEventListener("mouseup", handleGlobalMouseUp)
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp)
  }, [])

  // Time markers
  const timeMarkers: number[] = []
  if (totalDuration > 0) {
    const step = totalDuration > 60 ? 10 : totalDuration > 30 ? 5 : totalDuration > 15 ? 3 : 1
    for (let t = 0; t <= totalDuration; t += step) {
      timeMarkers.push(t)
    }
  }

  // Chapter markers
  const chapterMarkers = segments.filter((s) => s.chapter)

  const playheadPosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

  return (
    <div className="w-full bg-zinc-950 border-t border-zinc-800 p-4">
      {/* Time markers and chapters */}
      <div className="relative h-6 mb-2">
        {timeMarkers.map((time) => (
          <div
            key={time}
            className="absolute text-xs text-zinc-500 font-mono"
            style={{ left: `${totalDuration > 0 ? (time / totalDuration) * 100 : 0}%` }}
          >
            {time}s
          </div>
        ))}

        {/* Chapter markers */}
        {chapterMarkers.map((segment) => (
          <div
            key={`chapter-${segment.sceneId}`}
            className="absolute flex items-center gap-1 cursor-pointer group z-10"
            style={{ left: `${totalDuration > 0 ? (segment.startTime / totalDuration) * 100 : 0}%` }}
            onClick={() => seekTo(segment.startTime)}
          >
            <Bookmark className="w-3 h-3 text-pink-400 group-hover:text-pink-300" />
            <span className="text-xs text-pink-400/80 group-hover:text-pink-300 hidden group-hover:inline bg-zinc-900 px-1 rounded">
              {segment.chapter}
            </span>
          </div>
        ))}

        {/* User markers */}
        {markers.map((marker) => (
          <div
            key={marker.id}
            className="absolute flex items-center cursor-pointer group z-10"
            style={{ left: `${totalDuration > 0 ? (marker.time / totalDuration) * 100 : 0}%` }}
            onClick={() => seekTo(marker.time)}
          >
            <div className="w-2 h-2 rounded-full bg-amber-400 group-hover:scale-125 transition-transform" />
            <div className="hidden group-hover:flex items-center gap-1 ml-1 bg-zinc-800 rounded px-2 py-0.5">
              <span className="text-xs text-amber-400">{marker.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeMarker(marker.id)
                }}
                className="text-zinc-500 hover:text-red-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Timeline track */}
      <div
        ref={timelineRef}
        className="relative h-16 bg-zinc-900 rounded-lg overflow-hidden cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Scene segments with drag reorder */}
        <Reorder.Group
          axis="x"
          values={orderedSegments}
          onReorder={setOrderedSegments}
          className="absolute inset-0 flex"
        >
          {orderedSegments.map((segment) => {
            const widthPercent = totalDuration > 0 ? (segment.duration / totalDuration) * 100 : 0
            const isActive = currentTime >= segment.startTime && currentTime < segment.endTime
            const scene = scenes.find((s) => s.id === segment.sceneId)

            if (!scene) return null

            return (
              <TimelineSegment
                key={segment.sceneId}
                segment={segment}
                scene={scene}
                isActive={isActive}
                widthPercent={widthPercent}
                onClick={() => seekTo(segment.startTime)}
              />
            )
          })}
        </Reorder.Group>

        {/* Playhead */}
        <motion.div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none shadow-lg"
          style={{ left: `${playheadPosition}%` }}
          layoutId="playhead"
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
        </motion.div>
      </div>

      {/* Timeline info */}
      <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
        <span>
          {scenes.length} scene{scenes.length !== 1 ? "s" : ""} | {markers.length} marker
          {markers.length !== 1 ? "s" : ""}
        </span>
        <span>Total: {totalDuration.toFixed(1)}s</span>
      </div>
    </div>
  )
}
