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
    <header className="flex h-11 items-center justify-between gap-4 border-b border-border bg-panel px-3 shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 group relative">
         <Image src="/icon.png" alt="Markdown Video Logo" width={28} height={28} className="h-7 w-7 rounded-[5px]" />
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
          className="h-7 w-7 rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-30"
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
          className="h-7 w-7 rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-30"
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
          className="h-7 w-7 rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-30"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="min-w-10 text-center font-mono text-[11px] text-muted-foreground">{zoom}%</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const next = ZOOM_LEVELS.find((z) => z > zoom)
            if (next) setZoom(next)
          }}
          disabled={zoom >= 150}
          className="h-7 w-7 rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-30"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>

        <div className="w-px h-4 bg-line-strong dark:bg-line-strong mx-2" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-md px-2 font-mono text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">
              <Monitor className="w-4 h-4" />
              <span className="text-xs">{aspectRatio}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-border bg-popover">
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
          className="h-7 w-7 rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          title="Find (Ctrl+F)"
          aria-label="Find"
        >
          <Search className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowShortcuts(true)}
          className="h-7 w-7 rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          title="Keyboard Shortcuts (K)"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => togglePanel("templates")}
          aria-pressed={rightPanel === "templates"}
          className={cn(
            "inline-flex h-7 items-center rounded-md border border-border px-2.5 text-muted-foreground transition-colors duration-200",
            "hover:border-line-strong hover:bg-surface hover:text-foreground",
            rightPanel === "templates" && "border-accent bg-accent-soft text-accent"
          )}
        >
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]">
            Templates
          </span>
        </button>
        <button
          type="button"
          onClick={() => togglePanel("assets")}
          aria-pressed={rightPanel === "assets"}
          className={cn(
            "inline-flex h-7 items-center rounded-md border border-border px-2.5 text-muted-foreground transition-colors duration-200",
            "hover:border-line-strong hover:bg-surface hover:text-foreground",
            rightPanel === "assets" && "border-accent bg-accent-soft text-accent"
          )}
        >
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]">
            Assets
          </span>
        </button>
        <button
          type="button"
          onClick={() => togglePanel("guide")}
          aria-pressed={rightPanel === "guide"}
          className={cn(
            "inline-flex h-7 items-center rounded-md border border-border px-2.5 text-muted-foreground transition-colors duration-200",
            "hover:border-line-strong hover:bg-surface hover:text-foreground",
            rightPanel === "guide" && "border-accent bg-accent-soft text-accent"
          )}
          title="Syntax Guide (Press ?)"
        >
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]">
            Guide
          </span>
        </button>

        <div className="w-px h-4 bg-line-strong dark:bg-line-strong mx-2" />

        <button
          type="button"
          onClick={() => setShowShareModal(true)}
          className={cn(
            "inline-flex h-7 items-center rounded-md border border-border px-2.5 text-muted-foreground transition-colors duration-200",
            "hover:border-line-strong hover:bg-surface hover:text-foreground"
          )}
        >
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]">
            Share
          </span>
        </button>
        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          className={cn(
            "tool-button tool-button-primary h-7 px-2.5"
          )}
        >
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]">
            Export
          </span>
        </button>
      </div>
    </header>
  )
}
