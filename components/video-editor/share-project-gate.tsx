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
      <main className="flex h-screen items-center justify-center bg-white text-gray-600 dark:bg-neutral-950 dark:text-neutral-400">
        <div className="flex items-center gap-3 text-sm" role="status">
          <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400 dark:bg-neutral-500" aria-hidden="true" />
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
    <main className="flex h-screen items-center justify-center bg-white text-gray-900 dark:bg-neutral-950 dark:text-neutral-100">
      <p className="text-sm text-gray-500 dark:text-neutral-500">Shared project ready</p>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) keepLocalProject()
        }}
      >
        <DialogContent className="border-gray-200 bg-white text-gray-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-semibold">Open shared project?</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-neutral-400">
              A different project is already saved in this browser. Loading the shared project will replace that saved project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-neutral-800 dark:text-neutral-500">
                <span className="font-medium uppercase tracking-wide">Shared preview</span>
                <span>
                  {sharedSummary.lines} lines · {sharedSummary.characters.toLocaleString()} characters
                </span>
              </div>
              <pre
                tabIndex={0}
                aria-label="Shared markdown preview"
                className="max-h-36 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-5 text-gray-700 dark:text-neutral-300"
              >
                {sharedPreview}
              </pre>
            </div>

            {savedSummary && (
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                Your saved project has {savedSummary.lines} lines and {savedSummary.characters.toLocaleString()} characters.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={keepLocalProject}
              className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Keep my project
            </Button>
            <Button
              type="button"
              onClick={acceptSharedProject}
              className="border-0 bg-gray-900 text-white hover:bg-gray-800 dark:bg-neutral-100 dark:text-gray-900 dark:hover:bg-neutral-200"
            >
              Load shared project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
