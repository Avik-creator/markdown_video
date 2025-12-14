"use client"

import Link from "next/link"
import { Button } from "@components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
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
  )
}
