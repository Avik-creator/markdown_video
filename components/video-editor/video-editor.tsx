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
import { Button } from "@/components/ui/button"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type RightPanel = "properties" | "guide" | "templates"

const ASPECT_RATIOS = {
  "16:9": { label: "16:9 (YouTube)", width: 16, height: 9 },
  "9:16": { label: "9:16 (TikTok)", width: 9, height: 16 },
  "1:1": { label: "1:1 (Instagram)", width: 1, height: 1 },
  "4:3": { label: "4:3 (Classic)", width: 4, height: 3 },
}

const ZOOM_LEVELS = [50, 75, 100, 125, 150] as const

export function VideoEditor() {
  const [rightPanel, setRightPanel] = useState<RightPanel>("properties")
  const [showExportModal, setShowExportModal] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showFind, setShowFind] = useState(false)
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const isPlaying = useVideoStore((state) => state.isPlaying)
  const toggle = useVideoStore((state) => state.toggle)
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

      // Global shortcuts
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

      if (isEditing) return

      switch (e.key) {
        case " ":
          e.preventDefault()
          toggle()
          break
        case "ArrowLeft":
          e.preventDefault()
          if (e.shiftKey) {
            prevScene()
          } else {
            prevFrame()
          }
          break
        case "ArrowRight":
          e.preventDefault()
          if (e.shiftKey) {
            nextScene()
          } else {
            nextFrame()
          }
          break
        case "Home":
          e.preventDefault()
          seekTo(0)
          break
        case "End":
          e.preventDefault()
          seekTo(totalDuration)
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

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    toggle,
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

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-pink-500 flex items-center justify-center">
              <span className="text-xs font-bold">M</span>
            </div>
            <h1 className="text-sm font-semibold">Markdown Video</h1>
          </Link>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">Beta</span>

          <div className="w-px h-4 bg-zinc-700 mx-1" />

          <ProjectMenu />
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={!canUndo()}
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={redo}
            disabled={!canRedo()}
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </Button>

          <div className="w-px h-4 bg-zinc-700 mx-2" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const prev = [...ZOOM_LEVELS].reverse().find((z) => z < zoom)
              if (prev) setZoom(prev)
            }}
            disabled={zoom <= 50}
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-zinc-400 min-w-[40px] text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const next = ZOOM_LEVELS.find((z) => z > zoom)
              if (next) setZoom(next)
            }}
            disabled={zoom >= 150}
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          <div className="w-px h-4 bg-zinc-700 mx-2" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800">
                <Monitor className="w-4 h-4" />
                <span className="text-xs">{aspectRatio}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
              {Object.entries(ASPECT_RATIOS).map(([ratio, { label }]) => (
                <DropdownMenuItem
                  key={ratio}
                  onClick={() => setAspectRatio(ratio as keyof typeof ASPECT_RATIOS)}
                  className={`text-sm ${aspectRatio === ratio ? "text-pink-400" : "text-zinc-300"}`}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeSelector />

          <div className="w-px h-4 bg-zinc-700 mx-2" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowFind(!showFind)}
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
            title="Find (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowShortcuts(true)}
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
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
            className={`gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800 ${rightPanel === "templates" ? "bg-zinc-800 text-pink-500" : ""}`}
          >
            <Sparkles className="w-4 h-4" />
            Templates
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => togglePanel("guide")}
            className={`gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800 ${rightPanel === "guide" ? "bg-zinc-800 text-white" : ""}`}
          >
            <HelpCircle className="w-4 h-4" />
            Guide
          </Button>

          <div className="w-px h-4 bg-zinc-700 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShareModal(true)}
            className="gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
          <Button
            size="sm"
            onClick={() => setShowExportModal(true)}
            className="gap-2 bg-pink-500 hover:bg-pink-600 text-white border-0"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <MarkdownEditor />
        <div className="flex-1 flex flex-col min-w-0">
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
