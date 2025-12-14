"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { MarkdownEditor } from "./markdown-editor"
import { ScenePreview } from "./scene-preview"
import { Timeline } from "./timeline"
import { Controls } from "./controls"
import { SyntaxGuide } from "./syntax-guide"
import { SceneProperties } from "./scene-properties"
import { TemplatesPanel } from "./templates-panel"
import { ExportModal } from "./export-modal"
import { KeyboardShortcuts } from "./keyboard-shortcuts"
import { FindReplace } from "./find-replace"
import { ThemeSelector } from "./theme-selector"
import { ShareModal } from "./share-modal"
import { ProjectMenu } from "./project-menu"
import { Button } from "@components/ui/button"
import {
  HelpCircle,
  Download,
  Sparkles,
  Undo2,
  Redo2,
  Keyboard,
  Search,
  ZoomIn,
  ZoomOut,
  Monitor,
  Share2,
} from "lucide-react"
import { useVideoStore } from "@/lib/use-video-store"
import Link from "next/link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import CornerMarkers from "@components/CornerMarkers"
import { cn } from "@/lib/utils"

type RightPanel = "properties" | "guide" | "templates"

const ASPECT_RATIOS = {
  "16:9": { label: "16:9 (YouTube)", width: 16, height: 9 },
  "9:16": { label: "9:16 (TikTok)", width: 9, height: 16 },
  "1:1": { label: "1:1 (Instagram)", width: 1, height: 1 },
  "4:3": { label: "4:3 (Classic)", width: 4, height: 3 },
}

const ZOOM_LEVELS = [50, 75, 100, 125, 150] as const

export function VideoEditor({ initialMarkdown, isEmbed = false }: { initialMarkdown?: string; isEmbed?: boolean }) {
  const [rightPanel, setRightPanel] = useState<RightPanel>("properties")
  const [showExportModal, setShowExportModal] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showFind, setShowFind] = useState(false)
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const isPlaying = useVideoStore((state) => state.isPlaying)
  const toggle = useVideoStore((state) => state.toggle)
  const pause = useVideoStore((state) => state.pause)
  const seekTo = useVideoStore((state) => state.seekTo)
  const currentTime = useVideoStore((state) => state.currentTime)
  const totalDuration = useVideoStore((state) => state.totalDuration)
  const undo = useVideoStore((state) => state.undo)
  const redo = useVideoStore((state) => state.redo)
  const canUndo = useVideoStore((state) => state.canUndo)
  const canRedo = useVideoStore((state) => state.canRedo)
  const aspectRatio = useVideoStore((state) => state.aspectRatio)
  const setAspectRatio = useVideoStore((state) => state.setAspectRatio)
  const zoom = useVideoStore((state) => state.zoom)
  const setZoom = useVideoStore((state) => state.setZoom)
  const nextFrame = useVideoStore((state) => state.nextFrame)
  const prevFrame = useVideoStore((state) => state.prevFrame)
  const nextScene = useVideoStore((state) => state.nextScene)
  const prevScene = useVideoStore((state) => state.prevScene)
  const addMarker = useVideoStore((state) => state.addMarker)
  const markdown = useVideoStore((state) => state.markdown)
  const setMarkdown = useVideoStore((state) => state.setMarkdown)

  // Set initial markdown if provided
  useEffect(() => {
    if (initialMarkdown) {
      setMarkdown(initialMarkdown)
    }
  }, [initialMarkdown, setMarkdown])

  const saveProject = useCallback(() => {
    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "project.mdv"
    a.click()
    URL.revokeObjectURL(url)
  }, [markdown])

  const openProject = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".mdv,.md,.txt"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const text = await file.text()
        useVideoStore.getState().setMarkdown(text)
      }
    }
    input.click()
  }, [])

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
    saveProject,
    openProject,
  ])

  const togglePanel = (panel: RightPanel) => {
    setRightPanel((prev) => (prev === panel ? "properties" : panel))
  }

  if (isEmbed) {
    return (
      <div className="h-screen flex flex-col bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 overflow-hidden">
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          <div className="flex-1 flex flex-col min-w-0">
            <ScenePreview ref={previewRef} />
          </div>
        </div>
        <Controls />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group relative">
            <CornerMarkers variant="static" />
            <h1 className="text-sm font-serif font-semibold">Markdown Video</h1>
          </Link>

          <div className="w-px h-4 bg-zinc-700 mx-1" />

          <ProjectMenu />
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={!canUndo()}
            className="h-8 w-8 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={redo}
            disabled={!canRedo()}
            className="h-8 w-8 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </Button>

          <div className="w-px h-4 bg-gray-300 dark:bg-neutral-700 mx-2" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const prev = [...ZOOM_LEVELS].reverse().find((z) => z < zoom)
              if (prev) setZoom(prev)
            }}
            disabled={zoom <= 50}
            className="h-8 w-8 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-gray-600 dark:text-neutral-400 min-w-[40px] text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const next = ZOOM_LEVELS.find((z) => z > zoom)
              if (next) setZoom(next)
            }}
            disabled={zoom >= 150}
            className="h-8 w-8 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          <div className="w-px h-4 bg-gray-300 dark:bg-neutral-700 mx-2" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-2 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800">
                <Monitor className="w-4 h-4" />
                <span className="text-xs">{aspectRatio}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800">
              {Object.entries(ASPECT_RATIOS).map(([ratio, { label }]) => (
                <DropdownMenuItem
                  key={ratio}
                  onClick={() => setAspectRatio(ratio as keyof typeof ASPECT_RATIOS)}
                  className={`text-sm ${aspectRatio === ratio ? "text-gray-900 dark:text-neutral-100" : "text-gray-600 dark:text-neutral-400"}`}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeSelector />

          <div className="w-px h-4 bg-gray-300 dark:bg-neutral-700 mx-2" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowFind(!showFind)}
            className="h-8 w-8 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800"
            title="Find (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowShortcuts(true)}
            className="h-8 w-8 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800"
            title="Keyboard Shortcuts (K)"
          >
            <Keyboard className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => togglePanel("templates")}
            className={cn(
              "gap-2 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800",
              rightPanel === "templates" && "bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
            )}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Templates</span>
          </Button>
          <Button
            size="sm"
            onClick={() => togglePanel("guide")}
            className={cn(
              "gap-2 bg-pink-500/10 hover:bg-pink-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/30",
              rightPanel === "guide" && "bg-pink-500/20 border-pink-500/50"
            )}
            title="Syntax Guide (Press ?)"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="font-medium">Guide</span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-xs font-mono bg-white/20 dark:bg-black/20 rounded border border-pink-500/30">
              ?
            </kbd>
          </Button>

          <div className="w-px h-4 bg-gray-300 dark:bg-neutral-700 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShareModal(true)}
            className="gap-2 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setShowExportModal(true)}
            className="gap-2 bg-gray-900 dark:bg-neutral-100 hover:bg-gray-800 dark:hover:bg-neutral-200 text-white dark:text-gray-900 border-0"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <MarkdownEditor />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <ScenePreview ref={previewRef} />
        </div>
        {rightPanel === "guide" && <SyntaxGuide onClose={() => setRightPanel("properties")} />}
        {rightPanel === "templates" && <TemplatesPanel onClose={() => setRightPanel("properties")} />}
        {rightPanel === "properties" && <SceneProperties />}

        <FindReplace open={showFind} onClose={() => setShowFind(false)} showReplace={showFindReplace} />
      </div>

      <Controls />
      <Timeline />

      <ExportModal open={showExportModal} onOpenChange={setShowExportModal} previewRef={previewRef} />
      <KeyboardShortcuts open={showShortcuts} onOpenChange={setShowShortcuts} />
      <ShareModal open={showShareModal} onOpenChange={setShowShareModal} />
    </div>
  )
}
