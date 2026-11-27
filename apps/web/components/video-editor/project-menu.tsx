"use client"

import { useCallback } from "react"
import { useVideoStore } from "@/lib/use-video-store"
import { NEW_PROJECT_MARKDOWN } from "@/lib/default-markdown"
import { flushPendingEditorText } from "@/lib/editor/codemirror/store-sync"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import CornerMarkers from "@components/CornerMarkers"
import { FolderOpen, Save, FilePlus, Trash2 } from "lucide-react"
import { downloadMarkdownProject } from "@/lib/project-files"

export function ProjectMenu() {
  const setMarkdown = useVideoStore((state) => state.setMarkdown)

  const handleNew = useCallback(() => {
    if (confirm("Create new project? Unsaved changes will be lost.")) {
      flushPendingEditorText()
      setMarkdown(NEW_PROJECT_MARKDOWN)
    }
  }, [setMarkdown])

  const handleOpen = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".mdv,.md,.txt"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const text = await file.text()
        flushPendingEditorText()
        setMarkdown(text)
      }
    }
    input.click()
  }, [setMarkdown])

  const handleSave = useCallback(() => {
    flushPendingEditorText()
    downloadMarkdownProject(useVideoStore.getState().markdown)
  }, [])

  const handleClear = useCallback(() => {
    if (confirm("Clear all content?")) {
      flushPendingEditorText()
      setMarkdown("")
    }
  }, [setMarkdown])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-[-2px]"
          )}
        >
          <CornerMarkers />
          <span className="text-lg font-serif font-semibold text-foreground dark:text-foreground underline decoration-line-soft dark:decoration-line-soft underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            Project
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-panel border-border w-48">
        <DropdownMenuItem onClick={handleNew} className="text-foreground hover:text-white hover:bg-zinc-800">
          <FilePlus className="w-4 h-4 mr-2" />
          New Project
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+N</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpen} className="text-foreground hover:text-white hover:bg-zinc-800">
          <FolderOpen className="w-4 h-4 mr-2" />
          Open...
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+O</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSave} className="text-foreground hover:text-white hover:bg-zinc-800">
          <Save className="w-4 h-4 mr-2" />
          Save As...
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+S</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-panel-raised" />
        <DropdownMenuItem onClick={handleClear} className="text-destructive hover:text-red-300 hover:bg-zinc-800">
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
