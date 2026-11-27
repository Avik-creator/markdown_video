"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import { AlertCircle, Copy, Check, Link, Code, Share2 } from "lucide-react"
import { useVideoStore } from "@/lib/use-video-store"
import {
  buildInlineShareLink,
  canUseInlineShareLink,
  isShareDocumentTooLarge,
  MAX_SHARE_MARKDOWN_BYTES,
} from "@markdown-video/core"

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ShareLinkGenerationResult =
  | { url: string }
  | { error: string }

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`
  }
  return `${Math.ceil(bytes / 1000)} KB`
}

async function generateShareLink(markdown: string, origin: string): Promise<ShareLinkGenerationResult> {
  if (markdown.length === 0) {
    return {
      error: "This project is empty. Add markdown before creating a share link.",
    }
  }

  if (isShareDocumentTooLarge(markdown)) {
    return {
      error: `This project is larger than ${formatBytes(MAX_SHARE_MARKDOWN_BYTES)}, so it cannot be shared as a temporary link. Export the project or reduce its size instead.`,
    }
  }

  if (canUseInlineShareLink(markdown, origin)) {
    return { url: buildInlineShareLink(markdown, origin) }
  }

  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown }),
    })

    if (!response.ok) {
      if (response.status === 413) {
        return {
          error: "This project is too large for temporary link storage. Export the project or reduce its size instead.",
        }
      }

      if (response.status === 429) {
        return {
          error: "Too many share links were created recently. Wait a moment and try again.",
        }
      }

      return {
        error: "This project is too long for a direct link, and temporary project storage is unavailable right now. Try again later or export the project instead.",
      }
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      data = null
    }

    const projectId =
      typeof data === "object" && data !== null && "projectId" in data && typeof data.projectId === "string"
        ? data.projectId
        : null

    if (!projectId) {
      return {
        error: "Temporary project storage returned an unexpected response, so a reliable share link could not be created.",
      }
    }

    return { url: `${origin}/editor?project=${encodeURIComponent(projectId)}` }
  } catch {
    return {
      error: "This project is too long for a direct link, and temporary project storage could not be reached. Check your connection, try again later, or export the project instead.",
    }
  }
}

export function ShareModal({ open, onOpenChange }: ShareModalProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [embedSize, setEmbedSize] = useState<"small" | "medium" | "large">("medium")
  const [shareLink, setShareLink] = useState<string>("")
  const [shareError, setShareError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const markdown = useVideoStore((state) => state.markdown)

  const embedSizes = {
    small: { width: 560, height: 315 },
    medium: { width: 853, height: 480 },
    large: { width: 1280, height: 720 },
  }

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  // Generate share link when modal opens. Large projects use temporary Redis
  // storage; if that fails, keep the error visible rather than emitting a
  // broken sentinel URL.
  useEffect(() => {
    if (!open || typeof window === "undefined") {
      setShareLink("")
      setShareError(null)
      setIsGenerating(false)
      setCopied(null)
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = null
      }
      return
    }

    let cancelled = false
    setIsGenerating(true)
    setShareLink("")
    setShareError(null)

    generateShareLink(markdown, window.location.origin)
      .then((result) => {
        if (cancelled) return
        if ("url" in result) {
          setShareLink(result.url)
          setShareError(null)
        } else {
          setShareLink("")
          setShareError(result.error)
        }
        setIsGenerating(false)
      })
      .catch(() => {
        if (cancelled) return
        setShareLink("")
        setShareError("An unexpected error occurred while creating the share link. Export the project or try again.")
        setIsGenerating(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, markdown])

  const getEmbedCode = (width: number, height: number) => {
    if (!shareLink) return ""
    return `<iframe src="${shareLink}&embed=true" width="${width}" height="${height}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`
  }

  const flashCopied = (type: string) => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }
    setCopied(type)
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(null)
      copyTimeoutRef.current = null
    }, 2000)
  }

  const handleCopy = async (text: string, type: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      flashCopied(type)
    } catch {
      // Clipboard access can be denied by the browser. The text remains visible
      // in the read-only field/pre block for manual copying.
    }
  }

  const handleNativeShare = async () => {
    if (!shareLink) return
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Markdown Video",
          text: "Check out my video created with Markdown Video Editor",
          url: shareLink,
        })
      } catch {
        // User cancelled or share failed
      }
    }
  }

  const selectedEmbedSize = embedSizes[embedSize]
  const embedCode = getEmbedCode(selectedEmbedSize.width, selectedEmbedSize.height)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-panel dark:bg-panel border-border dark:border-border text-foreground dark:text-foreground max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif font-semibold">
            Share Project
          </DialogTitle>
          <DialogDescription className="text-muted-foreground dark:text-muted-foreground">
            Share your project via link or embed it on your website
          </DialogDescription>
        </DialogHeader>

        <span className="sr-only" aria-live="polite">
          {copied ? "Copied to clipboard" : ""}
        </span>

        {shareError && (
          <div
            role="alert"
            className="mt-4 flex gap-3 rounded-lg border border-destructive/40 bg-destructive-soft p-3 text-destructive dark:border-destructive/40 dark:bg-destructive-soft dark:text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Share link unavailable</p>
              <p className="text-destructive dark:text-destructive">{shareError}</p>
            </div>
          </div>
        )}

        <Tabs defaultValue="link" className="mt-4">
          <TabsList className="bg-surface dark:bg-surface w-full">
            <TabsTrigger value="link" className="flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-gray-900 dark:data-[state=active]:text-neutral-100">
              <Link className="w-4 h-4 mr-2" aria-hidden="true" />
              Share Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-gray-900 dark:data-[state=active]:text-neutral-100">
              <Code className="w-4 h-4 mr-2" aria-hidden="true" />
              Embed Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-share-link" className="text-sm text-muted-foreground dark:text-muted-foreground">Project Link</Label>
              <div className="flex gap-2">
                <Input
                  id="project-share-link"
                  value={isGenerating ? "Generating..." : shareLink}
                  placeholder={shareError ? "Share link unavailable" : ""}
                  readOnly
                  disabled={isGenerating || !shareLink}
                  aria-label="Project share link"
                  className="bg-panel dark:bg-surface border-border dark:border-border text-sm font-mono text-foreground dark:text-foreground"
                />
                <Button
                  type="button"
                  onClick={() => handleCopy(shareLink, "link")}
                  variant="outline"
                  disabled={isGenerating || !shareLink}
                  aria-label={copied === "link" ? "Project link copied" : "Copy project link"}
                  className="border-border dark:border-border bg-panel dark:bg-surface hover:bg-surface dark:hover:bg-surface shrink-0"
                >
                  {copied === "link" ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleNativeShare}
              disabled={!canNativeShare || isGenerating || !shareLink}
              className="w-full gap-2 bg-foreground dark:bg-foreground hover:bg-foreground/90 dark:hover:bg-foreground/90 text-foreground dark:text-background border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              Share via...
            </Button>

            <div className="bg-surface dark:bg-surface rounded-lg p-4 text-sm text-muted-foreground dark:text-muted-foreground">
              <p>
                Smaller projects are encoded directly in the link. Larger projects use temporary storage and expire after 7 days.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="mt-4 space-y-4">
            <div className="space-y-2">
              <span id="embed-size-label" className="block text-sm font-medium text-muted-foreground dark:text-muted-foreground">Embed Size</span>
              <div className="flex gap-2" role="group" aria-labelledby="embed-size-label">
                {(Object.keys(embedSizes) as Array<keyof typeof embedSizes>).map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant={embedSize === key ? "default" : "outline"}
                    size="sm"
                    aria-pressed={embedSize === key}
                    onClick={() => setEmbedSize(key)}
                    className={
                      embedSize === key
                        ? "bg-foreground dark:bg-foreground text-foreground dark:text-background"
                        : "bg-panel dark:bg-surface border-border dark:border-border text-foreground dark:text-foreground hover:bg-surface dark:hover:bg-surface"
                    }
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                    <span className="ml-1 text-xs opacity-60">
                      {embedSizes[key].width}x{embedSizes[key].height}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-muted-foreground dark:text-muted-foreground">Embed Code</span>
              <div className="relative overflow-hidden min-w-0">
                <pre
                  tabIndex={0}
                  aria-label="Embed code"
                  className="bg-panel dark:bg-surface border border-border dark:border-border rounded-lg p-3 pr-12 text-xs font-mono text-foreground dark:text-foreground break-all whitespace-pre-wrap w-full overflow-x-auto max-w-full min-h-20"
                >
                  {shareError
                    ? "Embed code is unavailable because a share link could not be created."
                    : isGenerating
                      ? "Generating embed code..."
                      : embedCode}
                </pre>
                <Button
                  type="button"
                  onClick={() => handleCopy(embedCode, "embed")}
                  size="sm"
                  disabled={!embedCode}
                  aria-label={copied === "embed" ? "Embed code copied" : "Copy embed code"}
                  className="absolute top-2 right-2 h-7 bg-surface dark:bg-surface hover:bg-surface dark:hover:bg-surface z-10"
                >
                  {copied === "embed" ? <Check className="w-3 h-3 text-green-600 dark:text-green-400" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-muted-foreground dark:text-muted-foreground">Preview</span>
              <div className="bg-surface dark:bg-surface border border-border dark:border-border rounded-lg overflow-hidden w-full">
                <div
                  className="relative w-full"
                  style={{
                    aspectRatio: `${selectedEmbedSize.width}/${selectedEmbedSize.height}`,
                    maxHeight: 400,
                    maxWidth: '100%',
                    width: '100%',
                  }}
                >
                  {shareLink ? (
                    <iframe
                      src={`${shareLink}&embed=true`}
                      className="border-0 absolute inset-0"
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'block',
                      }}
                      title="Embed Preview"
                      scrolling="no"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
                      <span className="text-muted-foreground dark:text-muted-foreground text-sm">
                        {shareError ? "Preview unavailable because a share link could not be created." : "Loading preview..."}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
