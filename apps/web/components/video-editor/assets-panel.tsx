"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
} from "react"
import {
  Copy,
  FileWarning,
  Image as ImageIcon,
  Music,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@components/ui/button"
import { cn } from "@/lib/utils"
import {
  ensureAssetLibraryLoaded,
  useAssetLibrary,
} from "@/lib/assets/asset-library"
import { assetKindFor, type AssetMetadata } from "@/lib/assets/asset-store"
import { getAssetObjectUrl } from "@/lib/assets/asset-resolution"
import {
  assetReferenceSnippet,
  referenceInsertionAt,
} from "@/lib/assets/asset-references"
import {
  findMissingAssetReferences,
  type MissingAssetReference,
} from "@/lib/assets/missing-assets"
import { useVideoStore } from "@/lib/use-video-store"
import type { MarkdownEditorHandle } from "./markdown-editor"

interface AssetsPanelProps {
  onClose: () => void
  editorRef: RefObject<MarkdownEditorHandle | null>
}

interface Notice {
  id: number
  tone: "info" | "warning" | "error"
  message: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null
  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  return `${minutes}:${String(rounded % 60).padStart(2, "0")}`
}

function useAudioDuration(asset: AssetMetadata, enabled: boolean): number | null {
  const [duration, setDuration] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled || typeof Audio === "undefined") return
    let cancelled = false
    let audio: HTMLAudioElement | null = null

    void getAssetObjectUrl(asset.id)
      .then((url) => {
        if (!url || cancelled) return
        audio = new Audio()
        audio.preload = "metadata"
        audio.addEventListener("loadedmetadata", () => {
          if (!cancelled) setDuration(audio?.duration ?? null)
        })
        audio.src = url
      })
      .catch(() => {
        // Row metadata remains useful even if optional duration probing fails.
      })

    return () => {
      cancelled = true
      audio?.removeAttribute("src")
      audio?.load()
    }
  }, [asset.id, enabled])

  return duration
}

function AssetRow({
  asset,
  onInsert,
  onCopy,
  onDelete,
}: {
  asset: AssetMetadata
  onInsert: () => void
  onCopy: () => void
  onDelete: () => void
}) {
  const kind = assetKindFor(asset.mimeType, asset.filename) ?? "image"
  const duration = useAudioDuration(asset, kind === "audio")
  const formattedDuration = formatDuration(duration)
  const Icon = kind === "audio" ? Music : ImageIcon

  return (
    <div
      data-asset-row={asset.filename}
      className="rounded-lg border border-border dark:border-border bg-surface dark:bg-surface p-3"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            kind === "audio"
              ? "bg-info-soft text-live dark:text-live"
              : "bg-info-soft text-info dark:text-info"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground dark:text-foreground" title={asset.filename}>
            {asset.filename}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground dark:text-muted-foreground">
            {kind === "audio" ? "Audio" : "Image"} · {formatBytes(asset.size)}
            {formattedDuration ? ` · ${formattedDuration}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onInsert}
          className="h-8 border border-border bg-panel px-2 text-xs text-foreground hover:bg-gray-100 dark:border-border dark:bg-surface dark:text-foreground dark:hover:bg-white/10"
          aria-label={`Insert reference to ${asset.filename}`}
        >
          <Plus className="h-3.5 w-3.5" />
          Insert
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCopy}
          className="h-8 border border-border bg-panel px-2 text-xs text-foreground hover:bg-gray-100 dark:border-border dark:bg-surface dark:text-foreground dark:hover:bg-white/10"
          aria-label={`Copy reference to ${asset.filename}`}
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="h-8 border border-border bg-panel px-2 text-xs text-destructive hover:bg-red-50 hover:text-red-700 dark:border-border dark:bg-surface dark:text-destructive dark:hover:bg-white/10 dark:hover:text-red-300"
          aria-label={`Delete ${asset.filename}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  )
}

export function AssetsPanel({ onClose, editorRef }: AssetsPanelProps) {
  const assets = useAssetLibrary((state) => state.assets)
  const status = useAssetLibrary((state) => state.status)
  const storageError = useAssetLibrary((state) => state.error)
  const uploadFiles = useAssetLibrary((state) => state.uploadFiles)
  const deleteAsset = useAssetLibrary((state) => state.deleteAsset)
  const refreshAssets = useAssetLibrary((state) => state.refreshAssets)
  const markdown = useVideoStore((state) => state.markdown)

  const inputRef = useRef<HTMLInputElement>(null)
  const noticeIdRef = useRef(0)
  const dragDepthRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const [missingReferences, setMissingReferences] = useState<MissingAssetReference[]>([])

  useEffect(() => {
    void ensureAssetLibraryLoaded()
  }, [])

  useEffect(() => {
    let cancelled = false
    void findMissingAssetReferences(markdown, { assets })
      .then((missing) => {
        if (!cancelled) setMissingReferences(missing)
      })
      .catch(() => {
        if (!cancelled) setMissingReferences([])
      })
    return () => {
      cancelled = true
    }
  }, [assets, markdown])

  const pushNotice = useCallback((tone: Notice["tone"], message: string) => {
    noticeIdRef.current += 1
    const id = noticeIdRef.current
    setNotices((current) => [...current.slice(-3), { id, tone, message }])
  }, [])

  const dismissNotice = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id))
  }, [])

  const upload = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return
      setIsUploading(true)
      try {
        const result = await uploadFiles(files)
        for (const uploaded of result.uploaded) {
          if (uploaded.renamed) {
            pushNotice(
              "info",
              `"${uploaded.originalFilename}" was saved as "${uploaded.asset.filename}" because the name was already used.`
            )
          } else {
            pushNotice("info", `Uploaded "${uploaded.asset.filename}".`)
          }
          if (uploaded.oversized) {
            pushNotice(
              "warning",
              `"${uploaded.asset.filename}" is larger than 10MB. It will remain local to this browser and may slow export or playback startup.`
            )
          }
        }
        for (const error of result.errors) {
          pushNotice("error", `${error.fileName}: ${error.message}`)
        }
      } finally {
        setIsUploading(false)
      }
    },
    [pushNotice, uploadFiles]
  )

  const hasFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files")

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDragging(false)
    void upload(Array.from(event.dataTransfer.files))
  }

  const copyReference = async (asset: AssetMetadata) => {
    const kind = assetKindFor(asset.mimeType, asset.filename) ?? "image"
    const snippet = assetReferenceSnippet(kind, asset.filename)
    try {
      await navigator.clipboard.writeText(snippet)
      pushNotice("info", `Copied ${snippet}`)
    } catch {
      pushNotice("error", "Clipboard access was unavailable; the reference could not be copied.")
    }
  }

  const insertReference = (asset: AssetMetadata) => {
    const kind = assetKindFor(asset.mimeType, asset.filename) ?? "image"
    const snippet = assetReferenceSnippet(kind, asset.filename)
    const editor = editorRef.current
    const text = editor?.getText()
    if (!editor || typeof text !== "string") {
      pushNotice("warning", "The editor is not ready; copy the reference instead.")
      return
    }

    const selection = editor.getSelection()
    const position = selection?.end ?? text.length
    const insertion = referenceInsertionAt(text, position, snippet)
    editor.replaceRange(position, position, insertion.insert)
    editor.selectRange(insertion.cursor, insertion.cursor)
    pushNotice("info", `Inserted ${snippet}`)
  }

  const removeAsset = async (asset: AssetMetadata) => {
    const confirmed = window.confirm(
      `Delete "${asset.filename}" from browser-local assets? Markdown references will remain and become missing-media warnings.`
    )
    if (!confirmed) return
    try {
      await deleteAsset(asset.id)
      pushNotice("info", `Deleted "${asset.filename}".`)
    } catch (error) {
      pushNotice(
        "error",
        error instanceof Error ? error.message : `Could not delete "${asset.filename}".`
      )
    }
  }

  return (
    <div
      className={cn(
        "relative flex h-full w-96 flex-col border-l border-border bg-panel dark:border-border dark:bg-[#0f0f14]",
        isDragging && "ring-2 ring-inset ring-info"
      )}
      onDragEnter={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        dragDepthRef.current += 1
        setIsDragging(true)
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event)) return
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
        if (dragDepthRef.current === 0) setIsDragging(false)
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ""
          void upload(files)
        }}
      />

      <div className="flex shrink-0 items-center justify-between border-b border-border p-4 dark:border-border">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-info dark:text-info" />
          <h2 className="font-semibold text-foreground dark:text-foreground">Assets</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-muted-foreground hover:text-gray-900 dark:text-muted-foreground dark:hover:text-white"
          aria-label="Close assets panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="shrink-0 border-b border-border p-4 dark:border-border">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-4 py-5 text-center transition-colors hover:border-sky-500 hover:bg-sky-50 disabled:opacity-60 dark:border-border dark:bg-surface dark:hover:border-sky-400 dark:hover:bg-sky-500/10"
        >
          <Upload className="mb-2 h-5 w-5 text-info dark:text-info" />
          <span className="text-sm font-medium text-foreground dark:text-foreground">
            {isUploading ? "Uploading…" : "Upload music or images"}
          </span>
          <span className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground">
            Click to browse or drop files anywhere in this panel
          </span>
        </button>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground dark:text-muted-foreground">
          Assets are stored only in this browser with IndexedDB. They are not uploaded to a server
          and are not included in share links or exported markdown files.
        </p>
      </div>

      {notices.length > 0 && (
        <div className="shrink-0 space-y-2 border-b border-border p-3 dark:border-border">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
                notice.tone === "error"
                  ? "border-destructive/40 bg-destructive-soft text-destructive dark:border-destructive/40 dark:bg-destructive-soft dark:text-destructive"
                  : notice.tone === "warning"
                    ? "border-warning/40 bg-warning-soft text-warning dark:border-warning/40 dark:bg-warning-soft dark:text-warning"
                    : "border-sky-200 bg-info-soft text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-info"
              )}
            >
              <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 break-words">{notice.message}</span>
              <button
                type="button"
                onClick={() => dismissNotice(notice.id)}
                className="shrink-0 opacity-70 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {missingReferences.length > 0 && (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft p-3 dark:border-warning/40 dark:bg-warning-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning dark:text-warning">
              Missing references
            </p>
            <div className="mt-2 space-y-1.5">
              {missingReferences.map((reference) => (
                <p key={`${reference.kind}:${reference.filename}:${reference.lineNumber}`} className="text-xs text-warning dark:text-warning">
                  Line {reference.lineNumber}: <code>./{reference.filename}</code> is not in browser assets or public static files.
                </p>
              ))}
            </div>
          </div>
        )}
        {status === "error" ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive-soft p-4 text-sm text-destructive dark:border-destructive/40 dark:bg-destructive-soft dark:text-destructive">
            <p className="font-medium">Browser asset storage is unavailable.</p>
            <p className="mt-1 text-xs">{storageError}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refreshAssets()}
              className="mt-3"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center dark:border-border">
            <div className="mb-3 flex gap-2 text-muted-foreground dark:text-muted-foreground">
              <Music className="h-5 w-5" />
              <ImageIcon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground dark:text-foreground">
              No browser-local assets yet
            </p>
            <p className="mt-2 max-w-64 text-xs leading-relaxed text-muted-foreground dark:text-muted-foreground">
              Upload an MP3, PNG, or other media file, then insert a reference such as
              <code className="mx-1 rounded bg-surface px-1 dark:bg-surface">./theme.mp3</code>
              into your markdown.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                onInsert={() => insertReference(asset)}
                onCopy={() => void copyReference(asset)}
                onDelete={() => void removeAsset(asset)}
              />
            ))}
          </div>
        )}
      </div>

      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-info-soft backdrop-blur-[1px]">
          <div className="rounded-lg border border-info bg-panel px-4 py-3 text-sm font-medium text-sky-700 shadow-lg dark:bg-panel dark:text-info">
            Drop to upload assets
          </div>
        </div>
      )}
    </div>
  )
}
