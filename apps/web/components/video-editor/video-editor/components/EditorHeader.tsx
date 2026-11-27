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
import type { ZoomLevel } from "@/lib/types"
import Image from "next/image"
import { useVideoStore } from "@/lib/use-video-store"
import { CloudOff } from "lucide-react"

interface EditorHeaderProps {
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  zoom: ZoomLevel
  setZoom: (zoom: ZoomLevel) => void
  aspectRatio: keyof typeof ASPECT_RATIOS
  setAspectRatio: (ratio: keyof typeof ASPECT_RATIOS) => void
  rightPanel: "properties" | "guide" | "templates" | "assets"
  togglePanel: (panel: "properties" | "guide" | "templates" | "assets") => void
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
  const persistenceFailed = useVideoStore((state) => state.persistenceFailed)

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-panel dark:bg-panel border-b border-border dark:border-border shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 group relative">
         <Image src="/icon.png" alt="Markdown Video Logo" width={64} height={64} />
        </Link>

        <div className="w-px h-4 bg-line-strong mx-1" />

        <ProjectMenu />

        {persistenceFailed && (
          <span
            role="alert"
            title="Browser storage is full or unavailable. Your changes are not being saved locally — download a project file copy with Ctrl+S."
            className="flex items-center gap-1.5 text-xs text-warning dark:text-warning"
          >
            <CloudOff className="w-3.5 h-3.5" />
            not saving — download a copy
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={undo}
          disabled={!canUndo()}
          className="h-8 w-8 text-muted-foreground dark:text-muted-foreground hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={redo}
          disabled={!canRedo()}
          className="h-8 w-8 text-muted-foreground dark:text-muted-foreground hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30"
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </Button>

        <div className="w-px h-4 bg-line-strong dark:bg-line-strong mx-2" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const prev = [...ZOOM_LEVELS].reverse().find((z) => z < zoom)
            if (prev) setZoom(prev)
          }}
          disabled={zoom <= 50}
          className="h-8 w-8 text-muted-foreground dark:text-muted-foreground hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground dark:text-muted-foreground min-w-10 text-center">{zoom}%</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const next = ZOOM_LEVELS.find((z) => z > zoom)
            if (next) setZoom(next)
          }}
          disabled={zoom >= 150}
          className="h-8 w-8 text-muted-foreground dark:text-muted-foreground hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>

        <div className="w-px h-4 bg-line-strong dark:bg-line-strong mx-2" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground dark:text-muted-foreground hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800">
              <Monitor className="w-4 h-4" />
              <span className="text-xs">{aspectRatio}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-panel dark:bg-surface border-border dark:border-border">
            {Object.entries(ASPECT_RATIOS).map(([ratio, { label }]) => (
              <DropdownMenuItem
                key={ratio}
                onClick={() => setAspectRatio(ratio as keyof typeof ASPECT_RATIOS)}
                className={`text-sm ${aspectRatio === ratio ? "text-foreground dark:text-foreground" : "text-muted-foreground dark:text-muted-foreground"}`}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeSelector />

        <div className="w-px h-4 bg-line-strong dark:bg-line-strong mx-2" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowFind(true)}
          className="h-8 w-8 text-muted-foreground dark:text-muted-foreground hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800"
          title="Find (Ctrl+F)"
          aria-label="Find"
        >
          <Search className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowShortcuts(true)}
          className="h-8 w-8 text-muted-foreground dark:text-muted-foreground hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800"
          title="Keyboard Shortcuts (K)"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => togglePanel("templates")}
          aria-pressed={rightPanel === "templates"}
          className={cn(
            "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-0.5"
          )}
        >
          <CornerMarkers />
          <span className="text-lg font-serif font-semibold text-foreground dark:text-foreground underline decoration-line-soft dark:decoration-line-soft underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            Templates
          </span>
        </button>
        <button
          type="button"
          onClick={() => togglePanel("assets")}
          aria-pressed={rightPanel === "assets"}
          className={cn(
            "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-0.5"
          )}
        >
          <CornerMarkers />
          <span className="text-lg font-serif font-semibold text-foreground dark:text-foreground underline decoration-line-soft dark:decoration-line-soft underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            Assets
          </span>
        </button>
        <button
          type="button"
          onClick={() => togglePanel("guide")}
          aria-pressed={rightPanel === "guide"}
          className={cn(
            "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-0.5"
          )}
          title="Syntax Guide (Press ?)"
        >
          <CornerMarkers />
          <span className="text-lg font-serif font-semibold text-foreground dark:text-foreground underline decoration-line-soft dark:decoration-line-soft underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            Guide
          </span>
        </button>

        <div className="w-px h-4 bg-line-strong dark:bg-line-strong mx-2" />

        <button
          type="button"
          onClick={() => setShowShareModal(true)}
          className={cn(
            "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-0.5"
          )}
        >
          <CornerMarkers />
          <span className="text-lg font-serif font-semibold text-foreground dark:text-foreground underline decoration-line-soft dark:decoration-line-soft underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            Share
          </span>
        </button>
        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          className={cn(
            "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
            "hover:translate-x-0.5"
          )}
        >
          <CornerMarkers />
          <span className="text-lg font-serif font-semibold text-foreground dark:text-foreground underline decoration-line-soft dark:decoration-line-soft underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
            Export
          </span>
        </button>
      </div>
    </header>
  )
}
