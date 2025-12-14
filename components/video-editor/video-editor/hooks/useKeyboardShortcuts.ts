"use client"

import { useEffect } from "react"
import { useVideoStore } from "@/lib/use-video-store"
import { ZOOM_LEVELS } from "../utils/constants"

interface UseKeyboardShortcutsOptions {
  toggle: () => void
  pause: () => void
  isPlaying: boolean
  seekTo: (time: number) => void
  currentTime: number
  totalDuration: number
  undo: () => void
  redo: () => void
  nextFrame: () => void
  prevFrame: () => void
  nextScene: () => void
  prevScene: () => void
  addMarker: (time: number, label: string) => void
  zoom: number
  setZoom: (zoom: number) => void
  rightPanel: "properties" | "guide" | "templates"
  setRightPanel: (panel: "properties" | "guide" | "templates") => void
  setShowFind: (show: boolean) => void
  setShowFindReplace: (show: boolean) => void
  setShowExportModal: (show: boolean) => void
  setShowShortcuts: (show: boolean) => void
  saveProject: () => void
  openProject: () => void
}

export function useKeyboardShortcuts({
  toggle,
  pause,
  isPlaying,
  seekTo,
  currentTime,
  totalDuration,
  undo,
  redo,
  nextFrame,
  prevFrame,
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
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isEditing = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement
      const isInputFocused = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLButtonElement

      // Global shortcuts (work even when editing)
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault()
        redo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault()
        setShowFind(true)
        setShowFindReplace(false)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "h") {
        e.preventDefault()
        setShowFind(true)
        setShowFindReplace(true)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        saveProject()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "o") {
        e.preventDefault()
        openProject()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault()
        setShowExportModal(true)
        return
      }

      // Don't handle playback shortcuts when editing text or focused on inputs
      if (isEditing || isInputFocused) return

      switch (e.key) {
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
            prevFrame()
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
            nextFrame()
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
        case "[":
          e.preventDefault()
          // Decrease playback speed
          const store = useVideoStore.getState()
          const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]
          const currentIndex = speeds.findIndex(s => Math.abs(s - store.playbackSpeed) < 0.01) || speeds.indexOf(1)
          if (currentIndex > 0) {
            store.setPlaybackSpeed(speeds[currentIndex - 1])
          }
          break
        case "]":
          e.preventDefault()
          // Increase playback speed
          const store2 = useVideoStore.getState()
          const speeds2 = [0.5, 0.75, 1, 1.25, 1.5, 2]
          const currentIndex2 = speeds2.findIndex(s => Math.abs(s - store2.playbackSpeed) < 0.01) || speeds2.indexOf(1)
          if (currentIndex2 < speeds2.length - 1) {
            store2.setPlaybackSpeed(speeds2[currentIndex2 + 1])
          }
          break
        case "?":
          e.preventDefault()
          setRightPanel(rightPanel === "guide" ? "properties" : "guide")
          break
        case "t":
        case "T":
          e.preventDefault()
          setRightPanel(rightPanel === "templates" ? "properties" : "templates")
          break
        case "f":
        case "F":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            document.documentElement.requestFullscreen?.()
          }
          break
        case "k":
        case "K":
          e.preventDefault()
          setShowShortcuts(true)
          break
        case "m":
        case "M":
          e.preventDefault()
          addMarker(currentTime, `Marker at ${currentTime.toFixed(1)}s`)
          break
        case "+":
        case "=":
          e.preventDefault()
          const nextZoomUp = ZOOM_LEVELS.find((z) => z > zoom)
          if (nextZoomUp) setZoom(nextZoomUp)
          break
        case "-":
          e.preventDefault()
          const nextZoomDown = [...ZOOM_LEVELS].reverse().find((z) => z < zoom)
          if (nextZoomDown) setZoom(nextZoomDown)
          break
        case "0":
          e.preventDefault()
          setZoom(100)
          break
        case "Escape":
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
    currentTime,
    totalDuration,
    rightPanel,
    undo,
    redo,
    nextFrame,
    prevFrame,
    nextScene,
    prevScene,
    addMarker,
    zoom,
    setZoom,
    setShowFind,
    setShowExportModal,
    setShowShortcuts,
    saveProject,
    openProject,
    setRightPanel,
  ])
}
