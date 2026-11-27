"use client"

import { useEffect } from "react"
import { useVideoStore } from "@/lib/use-video-store"
import type { ZoomLevel } from "@/lib/types"
import { ZOOM_LEVELS } from "../utils/constants"
import {
  DEFAULT_FRAME_RATE,
  PLAYBACK_SPEEDS,
  getShortcutTarget,
  hasPlainShortcutModifier,
  matchesCtrlOrMetaShortcut,
  normalizeKey,
  playbackSpeedIndex,
  shouldUsePlainShortcut,
  stepFrameTime,
} from "../utils/keyboard"

interface UseKeyboardShortcutsOptions {
  toggle: () => void
  pause: () => void
  isPlaying: boolean
  seekTo: (time: number) => void
  totalDuration: number
  undo: () => void
  redo: () => void
  nextScene: () => void
  prevScene: () => void
  addMarker: (time: number, label: string) => void
  zoom: ZoomLevel
  setZoom: (zoom: ZoomLevel) => void
  rightPanel: "properties" | "guide" | "templates"
  setRightPanel: (panel: "properties" | "guide" | "templates") => void
  setShowFind: (show: boolean) => void
  setShowFindReplace: (show: boolean) => void
  setShowExportModal: (show: boolean) => void
  setShowShortcuts: (show: boolean) => void
  saveProject: () => void
  openProject: () => void
  createNewProject: () => void
  openInsertPalette: () => void
}

export function useKeyboardShortcuts({
  toggle,
  pause,
  isPlaying,
  seekTo,
  totalDuration,
  undo,
  redo,
  nextScene,
  prevScene,
  addMarker,
  zoom,
  setZoom,
  rightPanel,
  setRightPanel,
  setShowFind,
  setShowFindReplace,
  setShowExportModal,
  setShowShortcuts,
  saveProject,
  openProject,
  createNewProject,
  openInsertPalette,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const stepOneFrame = (direction: "next" | "previous") => {
      // Read playback time imperatively. Subscribing to currentTime in the
      // top-level editor would re-render the entire editor on every frame.
      const store = useVideoStore.getState()
      const frameRate = store.exportSettings.fps ?? DEFAULT_FRAME_RATE
      seekTo(
        stepFrameTime(
          store.currentTime,
          direction,
          store.totalDuration,
          frameRate
        )
      )
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcuts (work even when editing). Key matching is
      // case-insensitive so Cmd+Shift+Z works although browsers report "Z".
      if (matchesCtrlOrMetaShortcut(e, "z")) {
        e.preventDefault()
        undo()
        return
      }
      if (matchesCtrlOrMetaShortcut(e, "z", { shiftKey: true })) {
        e.preventDefault()
        redo()
        return
      }
      if (matchesCtrlOrMetaShortcut(e, "f")) {
        e.preventDefault()
        setShowFind(true)
        setShowFindReplace(false)
        return
      }
      if (matchesCtrlOrMetaShortcut(e, "h")) {
        e.preventDefault()
        setShowFind(true)
        setShowFindReplace(true)
        return
      }
      if (matchesCtrlOrMetaShortcut(e, "s")) {
        e.preventDefault()
        saveProject()
        return
      }
      if (matchesCtrlOrMetaShortcut(e, "o")) {
        e.preventDefault()
        openProject()
        return
      }
      if (matchesCtrlOrMetaShortcut(e, "n")) {
        e.preventDefault()
        createNewProject()
        return
      }
      if (matchesCtrlOrMetaShortcut(e, "e")) {
        e.preventDefault()
        setShowExportModal(true)
        return
      }
      if (matchesCtrlOrMetaShortcut(e, "i")) {
        e.preventDefault()
        openInsertPalette()
        return
      }

      // Plain-key shortcuts are only plain-key shortcuts. Ctrl/Cmd/Alt
      // combinations such as Cmd+-, Cmd+[ and Alt+ArrowLeft belong to the
      // browser, platform or focused control.
      if (hasPlainShortcutModifier(e)) return

      const key = normalizeKey(e.key)
      if (!shouldUsePlainShortcut(getShortcutTarget(e.target), key)) return

      switch (key) {
        case " ":
          // Prevent space from scrolling the page
          e.preventDefault()
          e.stopPropagation()
          toggle()
          break
        case "ArrowLeft":
          e.preventDefault()
          // Pause when navigating frames
          if (isPlaying) {
            pause()
          }
          if (e.shiftKey) {
            prevScene()
          } else {
            stepOneFrame("previous")
          }
          break
        case "ArrowRight":
          e.preventDefault()
          // Pause when navigating frames
          if (isPlaying) {
            pause()
          }
          if (e.shiftKey) {
            nextScene()
          } else {
            stepOneFrame("next")
          }
          break
        case "Home":
          e.preventDefault()
          if (isPlaying) {
            pause()
          }
          seekTo(0)
          break
        case "End":
          e.preventDefault()
          if (isPlaying) {
            pause()
          }
          seekTo(totalDuration)
          break
        case "[": {
          e.preventDefault()
          // Decrease playback speed
          const store = useVideoStore.getState()
          const currentIndex = playbackSpeedIndex(
            PLAYBACK_SPEEDS,
            store.playbackSpeed
          )
          if (currentIndex > 0) {
            store.setPlaybackSpeed(PLAYBACK_SPEEDS[currentIndex - 1])
          }
          break
        }
        case "]": {
          e.preventDefault()
          // Increase playback speed
          const store = useVideoStore.getState()
          const currentIndex = playbackSpeedIndex(
            PLAYBACK_SPEEDS,
            store.playbackSpeed
          )
          if (currentIndex < PLAYBACK_SPEEDS.length - 1) {
            store.setPlaybackSpeed(PLAYBACK_SPEEDS[currentIndex + 1])
          }
          break
        }
        case "?":
          e.preventDefault()
          setRightPanel(rightPanel === "guide" ? "properties" : "guide")
          break
        case "t":
          e.preventDefault()
          setRightPanel(rightPanel === "templates" ? "properties" : "templates")
          break
        case "f":
          e.preventDefault()
          document.documentElement.requestFullscreen?.()
          break
        case "k":
          e.preventDefault()
          setShowShortcuts(true)
          break
        case "m": {
          e.preventDefault()
          const currentTime = useVideoStore.getState().currentTime
          addMarker(currentTime, `Marker at ${currentTime.toFixed(1)}s`)
          break
        }
        case "+":
        case "=": {
          e.preventDefault()
          const nextZoomUp = ZOOM_LEVELS.find((z) => z > zoom)
          if (nextZoomUp) setZoom(nextZoomUp)
          break
        }
        case "-": {
          e.preventDefault()
          const nextZoomDown = [...ZOOM_LEVELS].reverse().find((z) => z < zoom)
          if (nextZoomDown) setZoom(nextZoomDown)
          break
        }
        case "0":
          e.preventDefault()
          setZoom(100)
          break
        case "Escape":
          // Find inputs handle Escape locally so it works there without
          // stealing Escape from the editor's completion popup or other inputs.
          setShowFind(false)
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown, true) // Use capture phase to catch before default behavior
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [
    toggle,
    pause,
    isPlaying,
    seekTo,
    totalDuration,
    rightPanel,
    undo,
    redo,
    nextScene,
    prevScene,
    addMarker,
    zoom,
    setZoom,
    setShowFind,
    setShowFindReplace,
    setShowExportModal,
    setShowShortcuts,
    saveProject,
    openProject,
    createNewProject,
    openInsertPalette,
    setRightPanel,
  ])
}
