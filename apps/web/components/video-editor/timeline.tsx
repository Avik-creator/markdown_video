"use client"

import type React from "react"
import { useVideoStore } from "@/lib/use-video-store"
import { useEffect, useRef, useState, useCallback } from "react"
import { Bookmark, Trash2 } from "lucide-react"
import { Reorder, useDragControls } from "framer-motion"
import { cn } from "@/lib/utils"
import type { SourceRange, TimelineSegment as TimelineSegmentData } from "@markdown-video/core"
import {
  timeAtPosition,
  positionPercentForTime,
  buildTimeMarkers,
  exceedsDragThreshold,
  indexPermutation,
  adjacentReorder,
  reorderScenesInMarkdown,
} from "./timeline-utils"
import type { AdjacentReorderDirection } from "./timeline-utils"
import { flushPendingEditorText } from "@/lib/editor/codemirror/store-sync"

interface TimelineSegmentProps {
  segment: TimelineSegmentData
  scene: {
    id: string
    type: string
    text?: { content: string }
  }
  isActive: boolean
  widthPercent: number
  position: number
  onKeyboardSeek: () => void
  onKeyboardReorder: (position: number, direction: AdjacentReorderDirection) => void
  onReorderDragStart: () => void
  onReorderDragEnd: () => void
}

function TimelineSegment({
  segment,
  scene,
  isActive,
  widthPercent,
  position,
  onKeyboardSeek,
  onKeyboardReorder,
  onReorderDragStart,
  onReorderDragEnd,
}: TimelineSegmentProps) {
  const dragControls = useDragControls()

  const getPreviewText = () => {
    if (scene.text?.content) {
      return scene.text.content.slice(0, 20) + (scene.text.content.length > 20 ? "..." : "")
    }
    return scene.type.charAt(0).toUpperCase() + scene.type.slice(1)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only the primary button starts a reorder drag; clicks are handled
    // separately at the track level so press position can be measured.
    if (e.button !== 0) return
    dragControls.start(e)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const reorderDirection =
      e.key === "ArrowLeft" ? "left" : e.key === "ArrowRight" ? "right" : null
    if (
      reorderDirection &&
      (e.ctrlKey || e.metaKey) &&
      !e.altKey &&
      !e.shiftKey
    ) {
      e.preventDefault()
      // Ctrl/Cmd+Arrow is intentionally not a global seeking shortcut. Keep it
      // scoped to this focused segment so it cannot move playback accidentally.
      e.stopPropagation()
      onKeyboardReorder(position, reorderDirection)
      return
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      // Keep the global shortcut handler (Space toggles playback) quiet while
      // a timeline segment has focus.
      e.stopPropagation()
      onKeyboardSeek()
    }
  }

  const typeLabel = scene.type.charAt(0).toUpperCase() + scene.type.slice(1)

  return (
    <Reorder.Item
      as="div"
      value={segment}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      role="button"
      tabIndex={0}
      aria-roledescription="reorderable scene"
      aria-label={`${typeLabel} scene, ${segment.duration} seconds, starts at ${segment.startTime.toFixed(1)} seconds. Activate to seek to its start. Press Control or Command plus Left or Right Arrow to reorder.`}
      aria-keyshortcuts="Control+ArrowLeft Control+ArrowRight Meta+ArrowLeft Meta+ArrowRight"
      aria-describedby="timeline-reorder-instructions"
      data-timeline-scene-position={position}
      className={cn(
        "relative h-full flex items-center justify-center text-white text-sm font-medium border-r border-line last:border-r-0 transition-all cursor-grab active:cursor-grabbing select-none group",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:focus-visible:ring-accent focus-visible:ring-inset",
        isActive && "ring-1 ring-accent dark:ring-accent ring-inset",
      )}
      style={{
        width: `${widthPercent}%`,
        backgroundColor: segment.color,
        opacity: isActive ? 1 : 0.85,
      }}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDragStart={onReorderDragStart}
      onDragEnd={onReorderDragEnd}
      whileHover={{ opacity: 1 }}
      whileDrag={{ opacity: 1, scale: 1.03 }}
    >
      {/* Chapter marker */}
      {segment.chapter && (
        <div className="absolute top-1 right-1">
          <Bookmark className="w-3 h-3 text-white/80" />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col items-center gap-0.5 px-2 pointer-events-none">
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
  const [orderedSegments, setOrderedSegments] = useState(segments)
  const [reorderAnnouncement, setReorderAnnouncement] = useState("")

  // Mirror of the visual order that is updated synchronously inside framer
  // motion's onReorder, so the commit at drag end never reads stale state.
  const orderedSegmentsRef = useRef(segments)
  const isReorderDraggingRef = useRef(false)
  const lastDragEndTimeRef = useRef(-1000)
  const pressPositionRef = useRef<{ x: number; y: number } | null>(null)
  const isScrubbingRef = useRef(false)
  const pendingReorderFocusIndexRef = useRef<number | null>(null)

  useEffect(() => {
    orderedSegmentsRef.current = segments
    setOrderedSegments(segments)
  }, [segments])

  // Scene ids are regenerated whenever markdown is reparsed, so the first
  // synchronization effect can replace every timeline node. Restore focus only
  // after that synchronized order has actually reached the DOM.
  useEffect(() => {
    const focusIndex = pendingReorderFocusIndexRef.current
    if (focusIndex === null) return

    pendingReorderFocusIndexRef.current = null
    timelineRef.current
      ?.querySelector<HTMLElement>(`[data-timeline-scene-position="${focusIndex}"]`)
      ?.focus()
  }, [orderedSegments])

  const handleReorder = useCallback((newOrder: TimelineSegmentData[]) => {
    orderedSegmentsRef.current = newOrder
    setOrderedSegments(newOrder)
  }, [])

  const resetVisualOrder = useCallback(() => {
    // Read imperatively: after a mid-reorder flush reparse, the React closure
    // can still hold the pre-reparse segments for a frame.
    const currentSegments = useVideoStore.getState().segments
    orderedSegmentsRef.current = currentSegments
    setOrderedSegments(currentSegments)
  }, [])

  /**
   * Persist the visual reorder by rewriting the scene blocks in the markdown
   * source. If anything looks inconsistent the visual order snaps back to the
   * real one instead of corrupting the document.
   *
   * Uncommitted editor typing is flushed first, like every other flow that
   * rewrites the store markdown (project menu, templates): without the flush
   * the rewrite would be computed from stale text and the pending keystrokes
   * would be clobbered. State is then read imperatively because the flush's
   * reparse can make this callback's React closure stale — scene ids are
   * regenerated on every parse. When a flush did reparse mid-drag, the visual
   * order's stale ids no longer form a permutation of the fresh ones and the
   * reorder is dropped rather than applied to the wrong document. That drop
   * requires typing within the commit window before the drop of a drag, which
   * is vanishingly rare next to the certainty of never losing typed text.
   */
  const commitReorder = useCallback(() => {
    flushPendingEditorText()
    const state = useVideoStore.getState()

    const currentIds = state.segments.map((s) => s.sceneId)
    const reorderedIds = orderedSegmentsRef.current.map((s) => s.sceneId)
    const order = indexPermutation(currentIds, reorderedIds)

    if (!order) {
      resetVisualOrder()
      return false
    }
    // Nothing changed — the drag ended where it started.
    if (order.every((originalIndex, position) => originalIndex === position)) {
      return true
    }

    const ranges: SourceRange[] = []
    for (const segment of state.segments) {
      const scene = state.scenes.find((s) => s.id === segment.sceneId)
      const range = scene?.sourceMap?.scene
      if (!range) {
        resetVisualOrder()
        return false
      }
      ranges.push(range)
    }

    const newMarkdown = reorderScenesInMarkdown(state.markdown, ranges, order)
    if (newMarkdown === null) {
      resetVisualOrder()
      return false
    }
    state.setMarkdown(newMarkdown)
    return true
  }, [resetVisualOrder])

  const handleReorderDragStart = useCallback(() => {
    isReorderDraggingRef.current = true
  }, [])

  const handleReorderDragEnd = useCallback(() => {
    isReorderDraggingRef.current = false
    lastDragEndTimeRef.current = performance.now()
    commitReorder()
  }, [commitReorder])

  const handleKeyboardReorder = useCallback(
    (position: number, direction: AdjacentReorderDirection) => {
      // Flush before measuring anything: uncommitted typing reparses every
      // scene id, so a permutation computed from stale segments could never
      // apply cleanly. When nothing is pending the flush is a no-op and the
      // fresh state is the same state the closure already saw.
      flushPendingEditorText()
      const currentSegments = useVideoStore.getState().segments

      const reorder = adjacentReorder(currentSegments.length, position, direction)
      if (!reorder) {
        setReorderAnnouncement(
          direction === "left"
            ? "Scene is already at the start"
            : "Scene is already at the end"
        )
        return
      }

      const reorderedSegments = reorder.order.map((originalIndex) => currentSegments[originalIndex])
      orderedSegmentsRef.current = reorderedSegments

      if (!commitReorder()) {
        setReorderAnnouncement("Unable to reorder the scene in the markdown source")
        return
      }

      // setMarkdown parses synchronously. Adopt the freshly parsed segment
      // objects immediately so React never commits a frame that combines old
      // segment ids with the newly parsed scene ids.
      const committedSegments = useVideoStore.getState().segments
      orderedSegmentsRef.current = committedSegments
      setOrderedSegments(committedSegments)

      pendingReorderFocusIndexRef.current = reorder.targetIndex
      setReorderAnnouncement(
        `Scene moved to position ${reorder.targetIndex + 1} of ${currentSegments.length}`
      )
    },
    [commitReorder]
  )

  const handleTrackPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pressPositionRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  /**
   * Accurate click-to-seek. The click position — not the segment start — is
   * what matters, so a single handler at the track level covers clicks on
   * segments (which bubble up) and any gaps between them. Clicks that were
   * actually reorder drags are suppressed.
   */
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return

      // Suppress the click event that the browser still fires after a drag.
      if (isReorderDraggingRef.current) return
      if (performance.now() - lastDragEndTimeRef.current < 150) return
      const press = pressPositionRef.current
      if (press && exceedsDragThreshold(e.clientX - press.x, e.clientY - press.y)) return

      const rect = timelineRef.current.getBoundingClientRect()
      seekTo(timeAtPosition(e.clientX - rect.left, rect.width, totalDuration))
    },
    [totalDuration, seekTo],
  )

  const seekToClientX = useCallback(
    (clientX: number, element: HTMLElement) => {
      const rect = element.getBoundingClientRect()
      seekTo(timeAtPosition(clientX - rect.left, rect.width, totalDuration))
    },
    [seekTo, totalDuration],
  )

  const handleScrubPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      isScrubbingRef.current = true
      seekToClientX(e.clientX, e.currentTarget)
    },
    [seekToClientX],
  )

  const handleScrubPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isScrubbingRef.current) return
      seekToClientX(e.clientX, e.currentTarget)
    },
    [seekToClientX],
  )

  const handleScrubPointerEnd = useCallback(() => {
    isScrubbingRef.current = false
  }, [])

  const handleScrubKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Shift+Arrow is the global previous/next scene shortcut — let it through.
      if (e.shiftKey) return

      let targetTime: number | null = null
      switch (e.key) {
        case "ArrowLeft":
          targetTime = currentTime - 1
          break
        case "ArrowRight":
          targetTime = currentTime + 1
          break
        case "PageUp":
          targetTime = currentTime + 5
          break
        case "PageDown":
          targetTime = currentTime - 5
          break
        case "Home":
          targetTime = 0
          break
        case "End":
          targetTime = totalDuration
          break
      }
      if (targetTime === null) return

      e.preventDefault()
      // Keep the global shortcut handler quiet while scrubbing via keyboard.
      e.stopPropagation()
      seekTo(targetTime)
    },
    [currentTime, totalDuration, seekTo],
  )

  // Time markers
  const timeMarkers = buildTimeMarkers(totalDuration)

  // Chapter markers
  const chapterMarkers = segments.filter((s) => s.chapter)

  const playheadPosition = positionPercentForTime(currentTime, totalDuration)

  return (
    <div className="w-full bg-panel dark:bg-panel border-t border-border dark:border-border p-4">
      <span id="timeline-reorder-instructions" className="sr-only">
        Press Enter or Space to seek to this scene. Press Control or Command plus Left Arrow to move it earlier, or plus Right Arrow to move it later.
      </span>
      <div role="status" aria-live="polite" className="sr-only">
        {reorderAnnouncement}
      </div>

      {/* Time markers and chapters */}
      <div className="relative h-6 mb-2">
        {/* Scrub strip: click or drag to seek, arrow keys for keyboard seeking */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek through the video timeline"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={totalDuration}
          aria-valuenow={currentTime}
          aria-valuetext={`${currentTime.toFixed(1)} of ${totalDuration.toFixed(1)} seconds`}
          className="absolute inset-0 cursor-pointer select-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent dark:focus-visible:ring-accent"
          onPointerDown={handleScrubPointerDown}
          onPointerMove={handleScrubPointerMove}
          onPointerUp={handleScrubPointerEnd}
          onPointerCancel={handleScrubPointerEnd}
          onKeyDown={handleScrubKeyDown}
        />

        {timeMarkers.map((time) => (
          <div
            key={time}
            className="absolute text-xs text-muted-foreground dark:text-muted-foreground font-mono pointer-events-none"
            style={{ left: `${positionPercentForTime(time, totalDuration)}%` }}
          >
            {time}s
          </div>
        ))}

        {/* Chapter markers */}
        {chapterMarkers.map((segment) => (
          <button
            key={`chapter-${segment.sceneId}`}
            type="button"
            aria-label={`Seek to chapter ${segment.chapter} at ${segment.startTime.toFixed(1)} seconds`}
            className="absolute flex items-center gap-1 cursor-pointer group z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:focus-visible:ring-accent rounded-sm"
            style={{ left: `${positionPercentForTime(segment.startTime, totalDuration)}%` }}
            onClick={() => seekTo(segment.startTime)}
          >
            <Bookmark className="w-3 h-3 text-muted-foreground dark:text-muted-foreground group-hover:text-foreground dark:group-hover:text-foreground" />
            <span className="text-xs text-muted-foreground dark:text-muted-foreground group-hover:text-foreground dark:group-hover:text-foreground hidden group-hover:inline group-focus-visible:inline bg-panel dark:bg-surface px-1 rounded border border-border dark:border-border">
              {segment.chapter}
            </span>
          </button>
        ))}

        {/* User markers */}
        {markers.map((marker) => (
          <div
            key={marker.id}
            className="absolute flex items-center group z-10"
            style={{ left: `${positionPercentForTime(marker.time, totalDuration)}%` }}
          >
            <button
              type="button"
              aria-label={`Seek to marker ${marker.label} at ${marker.time.toFixed(1)} seconds`}
              className="flex items-center cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:focus-visible:ring-accent"
              onClick={() => seekTo(marker.time)}
            >
              <div className="w-2 h-2 rounded-full bg-line-strong dark:bg-line-strong group-hover:scale-125 transition-transform" />
            </button>
            <div className="hidden group-hover:flex group-focus-within:flex items-center gap-1 ml-1 bg-panel dark:bg-surface rounded px-2 py-0.5 border border-border dark:border-border">
              <span className="text-xs text-foreground dark:text-foreground">{marker.label}</span>
              <button
                type="button"
                aria-label={`Delete marker ${marker.label}`}
                onClick={(e) => {
                  e.stopPropagation()
                  removeMarker(marker.id)
                }}
                className="text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:focus-visible:ring-accent rounded-sm"
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
        className="relative h-16 bg-surface dark:bg-surface rounded-lg overflow-hidden cursor-pointer border border-border dark:border-border select-none"
        onPointerDown={handleTrackPointerDown}
        onClick={handleTrackClick}
      >
        {/* Scene segments with drag reorder */}
        <Reorder.Group
          as="div"
          axis="x"
          values={orderedSegments}
          onReorder={handleReorder}
          className="absolute inset-0 flex"
        >
          {orderedSegments.map((segment, position) => {
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
                position={position}
                onKeyboardSeek={() => seekTo(segment.startTime)}
                onKeyboardReorder={handleKeyboardReorder}
                onReorderDragStart={handleReorderDragStart}
                onReorderDragEnd={handleReorderDragEnd}
              />
            )
          })}
        </Reorder.Group>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground dark:bg-foreground z-20 pointer-events-none transition-none"
          style={{ left: `${playheadPosition}%`, willChange: "left" }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-foreground dark:bg-foreground rounded-full" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground dark:bg-foreground rounded-full" />
        </div>
      </div>

      {/* Timeline info */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
        <span>
          {scenes.length} scene{scenes.length !== 1 ? "s" : ""} | {markers.length} marker
          {markers.length !== 1 ? "s" : ""}
        </span>
        <span className="hidden sm:inline">Ctrl/⌘+←/→ reorders the focused scene</span>
        <span>Total: {totalDuration.toFixed(1)}s</span>
      </div>
    </div>
  )
}
