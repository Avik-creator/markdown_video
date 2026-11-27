"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { VideoEditor } from "@components/video-editor/video-editor"
import { Button } from "@components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog"
import { useVideoStore } from "@/lib/use-video-store"
import { DEFAULT_MARKDOWN } from "@/lib/default-markdown"

const VIDEO_STORE_STORAGE_KEY = "markdown-video-storage"
const PREVIEW_CHARACTER_LIMIT = 700

type GateDecision = "checking" | "pending" | "accepted" | "declined"

type PersistedStorage = NonNullable<ReturnType<typeof useVideoStore.persist.getOptions>["storage"]>
type PersistedStorageValue = Parameters<PersistedStorage["setItem"]>[1]

interface ShareProjectGateProps {
  initialMarkdown: string
  isEmbed?: boolean
}

function readSavedMarkdown(): string | null {
  try {
    const rawValue = window.localStorage.getItem(VIDEO_STORE_STORAGE_KEY)
    if (!rawValue) return null

    const parsedValue: unknown = JSON.parse(rawValue)
    if (typeof parsedValue !== "object" || parsedValue === null || !("state" in parsedValue)) {
      return null
    }

    const state = parsedValue.state
    if (typeof state !== "object" || state === null || !("markdown" in state)) {
      return null
    }

    return typeof state.markdown === "string" ? state.markdown : null
  } catch {
    return null
  }
}

function createMemoryPersistStorage(): PersistedStorage {
  const values = new Map<string, PersistedStorageValue>()

  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value)
    },
    removeItem: (name) => {
      values.delete(name)
    },
  }
}

function summarizeMarkdown(markdown: string): { lines: number; characters: number } {
  return {
    lines: markdown.length === 0 ? 0 : markdown.split(/\r?\n/).length,
    characters: markdown.length,
  }
}

/**
 * Whether the visitor's saved markdown is just the untouched default
 * document — in which case there is nothing worth protecting behind a
 * confirmation prompt. Compared exactly except for trailing whitespace: a
 * stray trailing newline or space carries no user content, while leading or
 * interior differences are real edits that keep the prompt.
 */
export function isUntouchedDefaultMarkdown(markdown: string): boolean {
  return markdown.trimEnd() === DEFAULT_MARKDOWN.trimEnd()
}

export function ShareProjectGate({ initialMarkdown, isEmbed = false }: ShareProjectGateProps) {
  const [decision, setDecision] = useState<GateDecision>("checking")
  const [savedMarkdown, setSavedMarkdown] = useState<string | null>(null)

  useEffect(() => {
    if (isEmbed) {
      // Embeds cannot show a meaningful confirmation prompt inside their small
      // iframe. Instead, point zustand persistence at memory for this page so
      // playback state never overwrites the visitor's saved local project.
      const persistApi = useVideoStore.persist
      if (!persistApi) {
        // Persistence is already unavailable (for example in a storage-restricted
        // browser context), so the embed cannot overwrite local storage.
        setDecision("accepted")
        return
      }

      const originalStorage = persistApi.getOptions().storage
      const memoryStorage = createMemoryPersistStorage()
      persistApi.setOptions({ storage: memoryStorage })
      setDecision("accepted")

      return () => {
        if (originalStorage) {
          useVideoStore.persist?.setOptions({ storage: originalStorage })
        }
      }
    }

    const localMarkdown = readSavedMarkdown()
    setSavedMarkdown(localMarkdown)

    if (
      localMarkdown === null ||
      localMarkdown === initialMarkdown ||
      isUntouchedDefaultMarkdown(localMarkdown)
    ) {
      setDecision("accepted")
    } else {
      setDecision("pending")
    }
  }, [initialMarkdown, isEmbed])

  const acceptSharedProject = useCallback(() => {
    setDecision("accepted")
  }, [])

  const keepLocalProject = useCallback(() => {
    setDecision((currentDecision) => (currentDecision === "pending" ? "declined" : currentDecision))
  }, [])

  const sharedPreview = useMemo(() => {
    if (initialMarkdown.length <= PREVIEW_CHARACTER_LIMIT) return initialMarkdown
    return `${initialMarkdown.slice(0, PREVIEW_CHARACTER_LIMIT)}…`
  }, [initialMarkdown])

  const sharedSummary = useMemo(() => summarizeMarkdown(initialMarkdown), [initialMarkdown])
  const savedSummary = useMemo(() => (savedMarkdown === null ? null : summarizeMarkdown(savedMarkdown)), [savedMarkdown])

  if (decision === "checking") {
    return (
      <main className="flex h-screen items-center justify-center bg-panel text-muted-foreground dark:bg-panel dark:text-muted-foreground">
        <div className="flex items-center gap-3 text-sm" role="status">
          <span className="h-2 w-2 animate-pulse rounded-full bg-line-strong dark:bg-line-strong" aria-hidden="true" />
          Checking shared project...
        </div>
      </main>
    )
  }

  if (decision === "accepted") {
    return <VideoEditor initialMarkdown={initialMarkdown} isEmbed={isEmbed} />
  }

  if (decision === "declined") {
    return <VideoEditor isEmbed={isEmbed} />
  }

  return (
    <main className="flex h-screen items-center justify-center bg-panel text-foreground dark:bg-panel dark:text-foreground">
      <p className="text-sm text-muted-foreground dark:text-muted-foreground">Shared project ready</p>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) keepLocalProject()
        }}
      >
        <DialogContent className="border-border bg-panel text-foreground dark:border-border dark:bg-panel dark:text-foreground">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-semibold">Open shared project?</DialogTitle>
            <DialogDescription className="text-muted-foreground dark:text-muted-foreground">
              A different project is already saved in this browser. Loading the shared project will replace that saved project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface dark:border-border dark:bg-surface">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground dark:border-border dark:text-muted-foreground">
                <span className="font-medium uppercase tracking-wide">Shared preview</span>
                <span>
                  {sharedSummary.lines} lines · {sharedSummary.characters.toLocaleString()} characters
                </span>
              </div>
              <pre
                tabIndex={0}
                aria-label="Shared markdown preview"
                className="max-h-36 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-5 text-foreground dark:text-foreground"
              >
                {sharedPreview}
              </pre>
            </div>

            {savedSummary && (
              <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                Your saved project has {savedSummary.lines} lines and {savedSummary.characters.toLocaleString()} characters.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={keepLocalProject}
              className="border-border bg-panel text-foreground hover:bg-surface dark:border-border dark:bg-surface dark:text-foreground dark:hover:bg-surface"
            >
              Keep my project
            </Button>
            <Button
              type="button"
              onClick={acceptSharedProject}
              className="border-0 bg-foreground text-foreground hover:bg-foreground/90 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
            >
              Load shared project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
