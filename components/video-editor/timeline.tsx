"use client"

import type React from "react"
import { useVideoStore } from "@/lib/use-video-store"
import { useEffect, useRef, useState, useCallback } from "react"
import { Bookmark, Trash2 } from "lucide-react"
import { Reorder, useDragControls } from "framer-motion"
import { cn } from "@/lib/utils"

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
        "relative h-full flex items-center justify-center text-white text-sm font-medium border-r border-black/20 last:border-r-0 transition-all cursor-pointer group",
        isActive && "ring-1 ring-gray-900 dark:ring-neutral-100 ring-inset",
      )}
      style={{
        width: `${widthPercent}%`,
        backgroundColor: segment.color,
        opacity: isActive ? 1 : 0.85,
      }}
      onClick={onClick}
      whileHover={{ opacity: 1 }}
    >
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
    <div className="w-full bg-white dark:bg-neutral-950 border-t border-gray-200 dark:border-neutral-800 p-4">
      {/* Time markers and chapters */}
      <div className="relative h-6 mb-2">
        {timeMarkers.map((time) => (
          <div
            key={time}
            className="absolute text-xs text-gray-500 dark:text-neutral-500 font-mono"
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
            <Bookmark className="w-3 h-3 text-gray-600 dark:text-neutral-400 group-hover:text-gray-900 dark:group-hover:text-neutral-100" />
            <span className="text-xs text-gray-600 dark:text-neutral-400 group-hover:text-gray-900 dark:group-hover:text-neutral-100 hidden group-hover:inline bg-white dark:bg-neutral-900 px-1 rounded border border-gray-200 dark:border-neutral-800">
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
            <div className="w-2 h-2 rounded-full bg-gray-600 dark:bg-neutral-400 group-hover:scale-125 transition-transform" />
            <div className="hidden group-hover:flex items-center gap-1 ml-1 bg-white dark:bg-neutral-900 rounded px-2 py-0.5 border border-gray-200 dark:border-neutral-800">
              <span className="text-xs text-gray-700 dark:text-neutral-300">{marker.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeMarker(marker.id)
                }}
                className="text-gray-500 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-neutral-100"
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
        className="relative h-16 bg-gray-100 dark:bg-neutral-900 rounded-lg overflow-hidden cursor-pointer border border-gray-200 dark:border-neutral-800"
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
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-900 dark:bg-neutral-100 z-20 pointer-events-none transition-none"
          style={{ left: `${playheadPosition}%`, willChange: "left" }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 dark:bg-neutral-100 rounded-full" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-neutral-100 rounded-full" />
        </div>
      </div>

      {/* Timeline info */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-neutral-500">
        <span>
          {scenes.length} scene{scenes.length !== 1 ? "s" : ""} | {markers.length} marker
          {markers.length !== 1 ? "s" : ""}
        </span>
        <span>Total: {totalDuration.toFixed(1)}s</span>
      </div>
    </div>
  )
}
