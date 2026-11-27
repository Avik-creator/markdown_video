"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { MarkdownEditor, type MarkdownEditorHandle } from "../markdown-editor"
import { ScenePreview } from "../scene-preview"
import { Timeline } from "../timeline"
import { Controls } from "../controls"
import { SyntaxGuide } from "../syntax-guide"
import { SceneProperties } from "../scene-properties"
import { TemplatesPanel } from "../templates-panel"
import { AssetsPanel } from "../assets-panel"
import { ExportModal } from "../export-modal"
import { KeyboardShortcuts } from "../keyboard-shortcuts"
import { FindReplace } from "../find-replace"
import { ShareModal } from "../share-modal"
import { InsertPalette } from "../insert-palette"
import { useVideoStore } from "@/lib/use-video-store"
import { NEW_PROJECT_MARKDOWN } from "@/lib/default-markdown"
import type { InsertableSnippet } from "@/lib/editor/snippets"
import { EditorHeader } from "./components/EditorHeader"
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts"

type RightPanel = "properties" | "guide" | "templates" | "assets"

export function VideoEditor({ initialMarkdown, isEmbed = false }: { initialMarkdown?: string; isEmbed?: boolean; }) {
  const [rightPanel, setRightPanel] = useState<RightPanel>("properties")
  const [showExportModal, setShowExportModal] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showFind, setShowFind] = useState(false)
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showInsertPalette, setShowInsertPalette] = useState(false)
  const editorRef = useRef<MarkdownEditorHandle>(null)

  const isPlaying = useVideoStore((state) => state.isPlaying)
  const toggle = useVideoStore((state) => state.toggle)
  const pause = useVideoStore((state) => state.pause)
  const seekTo = useVideoStore((state) => state.seekTo)
  const totalDuration = useVideoStore((state) => state.totalDuration)
  const undo = useVideoStore((state) => state.undo)
  const redo = useVideoStore((state) => state.redo)
  const canUndo = useVideoStore((state) => state.canUndo)
  const canRedo = useVideoStore((state) => state.canRedo)
  const aspectRatio = useVideoStore((state) => state.aspectRatio)
  const setAspectRatio = useVideoStore((state) => state.setAspectRatio)
  const zoom = useVideoStore((state) => state.zoom)
  const setZoom = useVideoStore((state) => state.setZoom)
  const nextScene = useVideoStore((state) => state.nextScene)
  const prevScene = useVideoStore((state) => state.prevScene)
  const addMarker = useVideoStore((state) => state.addMarker)
  const setMarkdown = useVideoStore((state) => state.setMarkdown)

  // Set initial markdown if provided
  useEffect(() => {
    if (initialMarkdown) {
      setMarkdown(initialMarkdown)
    }
  }, [initialMarkdown, setMarkdown])

  // The CodeMirror editor owns the live document and commits on a debounce,
  // so anything that reads or replaces the store markdown must first flush
  // pending typing — otherwise it operates on text up to 500ms stale and the
  // uncommitted keystrokes are silently lost.
  const flushEditor = useCallback(() => {
    editorRef.current?.flushPending()
  }, [])

  const undoWithFlush = useCallback(() => {
    // Flushing first makes the first undo step exactly the user's last
    // typing, rather than swallowing it into the previous commit.
    flushEditor()
    undo()
  }, [flushEditor, undo])

  const redoWithFlush = useCallback(() => {
    flushEditor()
    redo()
  }, [flushEditor, redo])

  const saveProject = useCallback(() => {
    flushEditor()
    const blob = new Blob([useVideoStore.getState().markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "project.mdv"
    a.click()
    URL.revokeObjectURL(url)
  }, [flushEditor])

  const openProject = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".mdv,.md,.txt"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const text = await file.text()
        // Commit pending typing so undo can restore the pre-open document.
        flushEditor()
        useVideoStore.getState().setMarkdown(text)
      }
    }
    input.click()
  }, [flushEditor])

  const openInsertPalette = useCallback(() => {
    setShowInsertPalette(true)
  }, [])

  const insertSnippet = useCallback((snippet: InsertableSnippet) => {
    if ("kind" in snippet && snippet.kind === "directive") {
      return editorRef.current?.insertDirective(snippet.markdown) ?? false
    }
    return editorRef.current?.insertSceneTemplate(snippet.markdown) ?? false
  }, [])

  const createNewProject = useCallback(() => {
    if (confirm("Create new project? Unsaved changes will be lost.")) {
      flushEditor()
      setMarkdown(NEW_PROJECT_MARKDOWN)
    }
  }, [flushEditor, setMarkdown])

  const openExportModal = useCallback(
    (open: boolean) => {
      if (open) flushEditor()
      setShowExportModal(open)
    },
    [flushEditor]
  )

  const openShareModal = useCallback(
    (open: boolean) => {
      if (open) flushEditor()
      setShowShareModal(open)
    },
    [flushEditor]
  )

  useKeyboardShortcuts({
    toggle,
    pause,
    isPlaying,
    seekTo,
    totalDuration,
    undo: undoWithFlush,
    redo: redoWithFlush,
    nextScene,
    prevScene,
    addMarker,
    zoom,
    setZoom,
    rightPanel,
    setRightPanel,
    setShowFind,
    setShowFindReplace,
    setShowExportModal: openExportModal,
    setShowShortcuts,
    saveProject,
    openProject,
    createNewProject,
    openInsertPalette,
  })

  const togglePanel = (panel: RightPanel) => {
    setRightPanel((prev) => (prev === panel ? "properties" : panel))
  }

  if (isEmbed) {
    return (
      <div className="h-screen flex flex-col bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 overflow-hidden">
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          <div className="flex-1 flex flex-col min-w-0 overflow-auto">
            <ScenePreview />
          </div>
        </div>
        <Controls />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 overflow-hidden">
      <EditorHeader
        undo={undoWithFlush}
        redo={redoWithFlush}
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
        setShowShareModal={openShareModal}
        setShowExportModal={openExportModal}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <MarkdownEditor ref={editorRef} onOpenInsertPalette={openInsertPalette} />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <ScenePreview />
        </div>
        {rightPanel === "guide" && <SyntaxGuide onClose={() => setRightPanel("properties")} />}
        {rightPanel === "templates" && <TemplatesPanel onClose={() => setRightPanel("properties")} />}
        {rightPanel === "assets" && <AssetsPanel editorRef={editorRef} onClose={() => setRightPanel("properties")} />}
        {rightPanel === "properties" && <SceneProperties />}

        <FindReplace
          open={showFind}
          onClose={() => setShowFind(false)}
          showReplace={showFindReplace}
          editorRef={editorRef}
        />
      </div>

      <Controls />
      <Timeline />

      <ExportModal open={showExportModal} onOpenChange={setShowExportModal} />
      <KeyboardShortcuts open={showShortcuts} onOpenChange={setShowShortcuts} />
      <ShareModal open={showShareModal} onOpenChange={setShowShareModal} />
      <InsertPalette
        open={showInsertPalette}
        onOpenChange={setShowInsertPalette}
        onInsert={insertSnippet}
      />
    </div>
  )
}
