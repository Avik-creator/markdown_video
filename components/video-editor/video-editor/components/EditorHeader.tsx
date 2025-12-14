"use client"

import Link from "next/link"
import { Button } from "@components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import {
  Undo2,
  Redo2,
  Keyboard,
  Search,
  ZoomIn,
  ZoomOut,
  Monitor,
} from "lucide-react"
import { cn } from "@/lib/utils"
import CornerMarkers from "@components/CornerMarkers"
import { ProjectMenu } from "../../project-menu"
import { ThemeSelector } from "../../theme-selector"
import { ASPECT_RATIOS, ZOOM_LEVELS } from "../utils/constants"

interface EditorHeaderProps {
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  zoom: number
  setZoom: (zoom: number) => void
  aspectRatio: keyof typeof ASPECT_RATIOS
  setAspectRatio: (ratio: keyof typeof ASPECT_RATIOS) => void
  rightPanel: "properties" | "guide" | "templates"
  togglePanel: (panel: "properties" | "guide" | "templates") => void
  setShowFind: (show: boolean) => void
  setShowShortcuts: (show: boolean) => void
  setShowShareModal: (show: boolean) => void
  setShowExportModal: (show: boolean) => void
}

export function EditorHeader({
  undo,
  redo,
  canUndo,
  canRedo,
  zoom,
  setZoom,
  aspectRatio,
  setAspectRatio,
  rightPanel,
  togglePanel,
  setShowFind,
  setShowShortcuts,
  setShowShareModal,
  setShowExportModal,
}: EditorHeaderProps) {
  return (
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
          onClick={() => setShowFind(true)}
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

      <div className="flex items-center gap-4">
        <button
          onClick={() => togglePanel("templates")}
          className={cn(
            "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-[-2px]"
          )}
        >
          <CornerMarkers />
          <span className="text-lg font-serif font-semibold text-gray-900 dark:text-neutral-100 underline decoration-gray-500 dark:decoration-neutral-400/50 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            <span className="hidden sm:inline">Templates</span>
            <span className="sm:hidden">Templates</span>
          </span>
        </button>
        <button
          onClick={() => togglePanel("guide")}
          className={cn(
            "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-[-2px]"
          )}
          title="Syntax Guide (Press ?)"
        >
          <CornerMarkers />
          <span className="text-lg font-serif font-semibold text-gray-900 dark:text-neutral-100 underline decoration-gray-500 dark:decoration-neutral-400/50 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            Guide
          </span>
        </button>

        <div className="w-px h-4 bg-gray-300 dark:bg-neutral-700 mx-2" />

        <button
          onClick={() => setShowShareModal(true)}
          className={cn(
            "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-[-2px]"
          )}
        >
          <CornerMarkers />
          <span className="text-lg font-serif font-semibold text-gray-900 dark:text-neutral-100 underline decoration-gray-500 dark:decoration-neutral-400/50 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            <span className="hidden sm:inline">Share</span>
            <span className="sm:hidden">Share</span>
          </span>
        </button>
        <button
          onClick={() => setShowExportModal(true)}
          className={cn(
            "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-[-2px]"
          )}
        >
          <CornerMarkers />
          <span className="text-lg font-serif font-semibold text-gray-900 dark:text-neutral-100 underline decoration-gray-500 dark:decoration-neutral-400/50 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            <span className="hidden sm:inline">Export</span>
            <span className="sm:hidden">Export</span>
          </span>
        </button>
      </div>
    </header>
  )
}
