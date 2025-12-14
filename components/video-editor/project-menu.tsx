"use client"

import { useCallback } from "react"
import { useVideoStore } from "@/lib/use-video-store"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import CornerMarkers from "@components/CornerMarkers"
import { FileText, FolderOpen, Save, FilePlus, Trash2 } from "lucide-react"

const DEFAULT_MARKDOWN = `!scene
!text
Hello World
animation: bounceIn
size: 2xl

!duration 3s
!background #3b82f6
!transition fade`

export function ProjectMenu() {
  const markdown = useVideoStore((state) => state.markdown)
  const setMarkdown = useVideoStore((state) => state.setMarkdown)

  const handleNew = useCallback(() => {
    if (confirm("Create new project? Unsaved changes will be lost.")) {
      setMarkdown(DEFAULT_MARKDOWN)
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
        setMarkdown(text)
      }
    }
    input.click()
  }, [setMarkdown])

  const handleSave = useCallback(() => {
    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "project.mdv"
    a.click()
    URL.revokeObjectURL(url)
  }, [markdown])

  const handleClear = useCallback(() => {
    if (confirm("Clear all content?")) {
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
          <span className="text-lg font-serif font-semibold text-gray-900 dark:text-neutral-100 underline decoration-gray-500 dark:decoration-neutral-400/50 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            Project
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-zinc-900 border-zinc-800 w-48">
        <DropdownMenuItem onClick={handleNew} className="text-zinc-300 hover:text-white hover:bg-zinc-800">
          <FilePlus className="w-4 h-4 mr-2" />
          New Project
          <span className="ml-auto text-xs text-zinc-500">Ctrl+N</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpen} className="text-zinc-300 hover:text-white hover:bg-zinc-800">
          <FolderOpen className="w-4 h-4 mr-2" />
          Open...
          <span className="ml-auto text-xs text-zinc-500">Ctrl+O</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSave} className="text-zinc-300 hover:text-white hover:bg-zinc-800">
          <Save className="w-4 h-4 mr-2" />
          Save As...
          <span className="ml-auto text-xs text-zinc-500">Ctrl+S</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem onClick={handleClear} className="text-red-400 hover:text-red-300 hover:bg-zinc-800">
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
