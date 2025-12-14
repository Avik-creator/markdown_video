"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { MarkdownEditor } from "../markdown-editor"
import { ScenePreview } from "../scene-preview"
import { Timeline } from "../timeline"
import { Controls } from "../controls"
import { SyntaxGuide } from "../syntax-guide"
import { SceneProperties } from "../scene-properties"
import { TemplatesPanel } from "../templates-panel"
import { ExportModal } from "../export-modal"
import { KeyboardShortcuts } from "../keyboard-shortcuts"
import { FindReplace } from "../find-replace"
import { ShareModal } from "../share-modal"
import { useVideoStore } from "@/lib/use-video-store"
import { EditorHeader } from "./components/EditorHeader"
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts"

type RightPanel = "properties" | "guide" | "templates"

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

  useKeyboardShortcuts({
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
  })

  const togglePanel = (panel: RightPanel) => {
    setRightPanel((prev) => (prev === panel ? "properties" : panel))
  }

  if (isEmbed) {
    return (
      <div className="h-screen flex flex-col bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 overflow-hidden">
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          <div className="flex-1 flex flex-col min-w-0 overflow-auto">
            <ScenePreview ref={previewRef} />
          </div>
        </div>
        <Controls />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 overflow-hidden">
      <EditorHeader
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={zoom}
        setZoom={setZoom}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        rightPanel={rightPanel}
        togglePanel={togglePanel}
        setShowFind={setShowFind}
        setShowShortcuts={setShowShortcuts}
        setShowShareModal={setShowShareModal}
        setShowExportModal={setShowExportModal}
      />

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
