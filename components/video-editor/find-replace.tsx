"use client"

import { useState, useEffect } from "react"
import { useVideoStore } from "@/lib/use-video-store"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { X, ChevronDown, ChevronUp, Replace } from "lucide-react"

interface FindReplaceProps {
  open: boolean
  onClose: () => void
  showReplace?: boolean
}

export function FindReplace({ open, onClose, showReplace = false }: FindReplaceProps) {
  const [showReplaceRow, setShowReplaceRow] = useState(showReplace)
  const findText = useVideoStore((state) => state.findText)
  const replaceText = useVideoStore((state) => state.replaceText)
  const setFindText = useVideoStore((state) => state.setFindText)
  const setReplaceText = useVideoStore((state) => state.setReplaceText)
  const replaceNext = useVideoStore((state) => state.replaceNext)
  const replaceAll = useVideoStore((state) => state.replaceAll)
  const markdown = useVideoStore((state) => state.markdown)

  const [matchCount, setMatchCount] = useState(0)

  useEffect(() => {
    if (findText) {
      const matches = markdown.split(findText).length - 1
      setMatchCount(matches)
    } else {
      setMatchCount(0)
    }
  }, [findText, markdown])

  useEffect(() => {
    setShowReplaceRow(showReplace)
  }, [showReplace])

  if (!open) return null

  return (
    <div className="absolute top-12 right-4 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-3 w-80">
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zinc-400 hover:text-white"
          onClick={() => setShowReplaceRow(!showReplaceRow)}
        >
          {showReplaceRow ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>

        <Input
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          placeholder="Find..."
          className="flex-1 h-8 bg-zinc-800 border-zinc-700 text-sm"
          autoFocus
        />

        <span className="text-xs text-zinc-500 min-w-[40px]">
          {matchCount > 0 ? `${matchCount} found` : "No match"}
        </span>

        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-white" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {showReplaceRow && (
        <div className="flex items-center gap-2 mt-2">
          <div className="w-6" /> {/* Spacer for alignment */}
          <Input
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace with..."
            className="flex-1 h-8 bg-zinc-800 border-zinc-700 text-sm"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={replaceNext}
            className="h-8 text-xs text-zinc-400 hover:text-white"
          >
            <Replace className="w-3 h-3 mr-1" />
            One
          </Button>
          <Button variant="ghost" size="sm" onClick={replaceAll} className="h-8 text-xs text-zinc-400 hover:text-white">
            All
          </Button>
        </div>
      )}
    </div>
  )
}
