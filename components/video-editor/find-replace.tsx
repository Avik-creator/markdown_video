"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
import { useVideoStore } from "@/lib/use-video-store"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { X, ChevronDown, ChevronUp, Replace } from "lucide-react"
import type { MarkdownEditorHandle } from "./markdown-editor"
import {
  findExactMatchIndex,
  findMatches,
  getMatchIndexAfterReplacement,
  getNextMatchIndex,
  getPreviousMatchIndex,
  replaceMatch,
} from "./video-editor/utils/find-matches"

interface FindReplaceProps {
  open: boolean
  onClose: () => void
  showReplace?: boolean
  editorRef?: RefObject<MarkdownEditorHandle | null>
}

interface SelectionTarget {
  start: number
  end: number
  /** Positions are only valid for this exact document revision. */
  markdown: string
}

export function FindReplace({
  open,
  onClose,
  showReplace = false,
  editorRef,
}: FindReplaceProps) {
  const [showReplaceRow, setShowReplaceRow] = useState(showReplace)
  const findText = useVideoStore((state) => state.findText)
  const replaceText = useVideoStore((state) => state.replaceText)
  const setFindText = useVideoStore((state) => state.setFindText)
  const setReplaceText = useVideoStore((state) => state.setReplaceText)
  const replaceAll = useVideoStore((state) => state.replaceAll)
  const setMarkdown = useVideoStore((state) => state.setMarkdown)
  const markdown = useVideoStore((state) => state.markdown)

  const matches = useMemo(() => findMatches(markdown, findText), [markdown, findText])
  const [activeMatchState, setActiveMatchState] = useState({
    query: "",
    index: 0,
  })
  const [selectionTarget, setSelectionTarget] = useState<SelectionTarget | null>(null)
  const wasOpenRef = useRef(false)

  // The editor owns the live document and commits to the store on a debounce,
  // so reading the store alone can miss the last few hundred milliseconds of
  // typing. Flush first and then read the store fresh; the local `markdown`
  // render snapshot may still be stale within this same tick.
  const readFreshMarkdown = useCallback(() => {
    editorRef?.current?.flushPending()
    return useVideoStore.getState().markdown
  }, [editorRef])

  const activeMatchIndex = useMemo(() => {
    if (matches.length === 0) return -1
    if (activeMatchState.query !== findText || activeMatchState.index < 0) return 0
    return Math.min(activeMatchState.index, matches.length - 1)
  }, [activeMatchState, findText, matches.length])

  const hasMatches = matches.length > 0

  useEffect(() => {
    setShowReplaceRow(showReplace)
  }, [showReplace])

  // When the panel opens with an existing query, select the active match once.
  // After that, selection only changes in response to explicit find/replace
  // actions, so editing the document does not keep stealing the user's caret.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // Match offsets must be computed against the live document, including
      // any typing the editor has not committed yet — the memoized matches
      // can be one commit behind within this tick.
      const freshMarkdown = readFreshMarkdown()
      const freshMatches = findMatches(freshMarkdown, findText)
      let index = -1;
      if (freshMatches.length > 0) {
        index = activeMatchState.query !== findText || activeMatchState.index < 0
          ? 0
          : Math.min(activeMatchState.index, freshMatches.length - 1)
      }
      const match = index >= 0 ? freshMatches[index] : undefined
      if (match) {
        setSelectionTarget({
          start: match.start,
          end: match.end,
          markdown: freshMarkdown,
        })
      }
    }
    wasOpenRef.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, findText, readFreshMarkdown])

  useEffect(() => {
    if (!open || !selectionTarget || selectionTarget.markdown !== markdown) return
    editorRef?.current?.selectRange(selectionTarget.start, selectionTarget.end)
  }, [open, selectionTarget, markdown, editorRef])

  const goToMatch = useCallback(
    (direction: "next" | "previous") => {
      // Navigation depends on exact offsets, so work from the live document
      // rather than a render snapshot one commit behind.
      const freshMarkdown = readFreshMarkdown()
      const freshMatches = findMatches(freshMarkdown, findText)

      // If the user manually selected an exact match in the editor, navigate
      // relative to that selection rather than the previously active match.
      const editorSelection = editorRef?.current?.getSelection()
      const selectedMatchIndex = editorSelection
        ? findExactMatchIndex(freshMatches, editorSelection.start, editorSelection.end)
        : -1
      const memoIndex =
        freshMatches.length === 0
          ? -1
          : activeMatchState.query !== findText || activeMatchState.index < 0
            ? 0
            : Math.min(activeMatchState.index, freshMatches.length - 1)
      const currentIndex = selectedMatchIndex >= 0 ? selectedMatchIndex : memoIndex
      const nextIndex =
        direction === "next"
          ? getNextMatchIndex(currentIndex, freshMatches.length)
          : getPreviousMatchIndex(currentIndex, freshMatches.length)
      if (nextIndex === -1) return

      const match = freshMatches[nextIndex]
      setActiveMatchState({ query: findText, index: nextIndex })
      setSelectionTarget(
        match
          ? { start: match.start, end: match.end, markdown: freshMarkdown }
          : null
      )
    },
    [activeMatchState, editorRef, findText, readFreshMarkdown]
  )

  const handleFindChange = (value: string) => {
    setFindText(value)
    const freshMarkdown = readFreshMarkdown()
    const nextMatches = findMatches(freshMarkdown, value)
    const index = nextMatches.length > 0 ? 0 : -1
    setActiveMatchState({ query: value, index })

    if (index >= 0) {
      setSelectionTarget({
        start: nextMatches[index].start,
        end: nextMatches[index].end,
        markdown: freshMarkdown,
      })
    } else {
      setSelectionTarget(null)
    }
  }

  const handleReplaceOne = useCallback(() => {
    if (!findText || activeMatchIndex < 0) return

    // Replacement offsets are exact positions in the live document; flushing
    // first keeps uncommitted typing from shifting them.
    const freshMarkdown = readFreshMarkdown()
    const freshMatches = findMatches(freshMarkdown, findText)

    // Navigation selects the current match in the editor. If the user has
    // manually selected another exact match, honor that selection instead of
    // falling back to the first or previously active occurrence.
    const editorSelection = editorRef?.current?.getSelection()
    const selectedMatchIndex = editorSelection
      ? findExactMatchIndex(freshMatches, editorSelection.start, editorSelection.end)
      : -1
    const matchIndex = selectedMatchIndex >= 0 ? selectedMatchIndex : activeMatchIndex
    const match = freshMatches[matchIndex]
    if (!match) return

    const nextMarkdown = replaceMatch(freshMarkdown, match, replaceText)
    const nextMatches = findMatches(nextMarkdown, findText)
    const nextIndex = getMatchIndexAfterReplacement(
      nextMatches,
      match.start,
      replaceText.length
    )

    setActiveMatchState({ query: findText, index: nextIndex })
    if (nextIndex >= 0) {
      setSelectionTarget({
        start: nextMatches[nextIndex].start,
        end: nextMatches[nextIndex].end,
        markdown: nextMarkdown,
      })
    } else {
      setSelectionTarget(null)
    }
    setMarkdown(nextMarkdown)
  }, [activeMatchIndex, editorRef, findText, readFreshMarkdown, replaceText, setMarkdown])

  const handleReplaceAll = useCallback(() => {
    // replaceAll rewrites the store document wholesale; it must apply to the
    // live text, not a commit lagging behind the editor.
    readFreshMarkdown()
    replaceAll()
  }, [readFreshMarkdown, replaceAll])

  const handleFindKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      goToMatch(e.shiftKey ? "previous" : "next")
      return
    }
    if (e.key === "Escape") {
      onClose()
    }
  }

  const handleReplaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleReplaceOne()
      return
    }
    if (e.key === "Escape") {
      onClose()
    }
  }

  if (!open) return null

  const matchLabel = !findText
    ? ""
    : hasMatches
      ? `${activeMatchIndex + 1} of ${matches.length}`
      : "No match"

  return (
    <div
      role="dialog"
      aria-label={showReplaceRow ? "Find and replace" : "Find"}
      className="absolute top-12 right-4 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-3 w-80"
    >
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zinc-400 hover:text-white"
          onClick={() => setShowReplaceRow(!showReplaceRow)}
          aria-label={showReplaceRow ? "Hide replace controls" : "Show replace controls"}
          aria-expanded={showReplaceRow}
          title={showReplaceRow ? "Hide replace controls" : "Show replace controls"}
        >
          {showReplaceRow ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>

        <Input
          value={findText}
          onChange={(e) => handleFindChange(e.target.value)}
          onKeyDown={handleFindKeyDown}
          placeholder="Find..."
          aria-label="Find text"
          className="flex-1 h-8 bg-zinc-800 border-zinc-700 text-sm"
          autoFocus
        />

        <span
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-zinc-500 min-w-[52px] text-center"
        >
          {matchLabel}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zinc-400 hover:text-white"
          onClick={() => goToMatch("previous")}
          disabled={!hasMatches}
          aria-label="Previous match"
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zinc-400 hover:text-white"
          onClick={() => goToMatch("next")}
          disabled={!hasMatches}
          aria-label="Next match"
          title="Next match (Enter)"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zinc-400 hover:text-white"
          onClick={onClose}
          aria-label="Close find"
          title="Close find (Escape)"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {showReplaceRow && (
        <div className="flex items-center gap-2 mt-2">
          <div className="w-6" /> {/* Spacer for alignment */}
          <Input
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder="Replace with..."
            aria-label="Replace text"
            className="flex-1 h-8 bg-zinc-800 border-zinc-700 text-sm"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReplaceOne}
            disabled={!hasMatches}
            className="h-8 text-xs text-zinc-400 hover:text-white"
            aria-label="Replace one match"
            title="Replace current match"
          >
            <Replace className="w-3 h-3 mr-1" />
            One
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReplaceAll}
            disabled={!hasMatches}
            className="h-8 text-xs text-zinc-400 hover:text-white"
            aria-label="Replace all matches"
            title="Replace all matches"
          >
            All
          </Button>
        </div>
      )}
    </div>
  )
}
