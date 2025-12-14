"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check, Link, Code, Share2 } from "lucide-react"
import { useVideoStore } from "@/lib/use-video-store"

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShareModal({ open, onOpenChange }: ShareModalProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [embedSize, setEmbedSize] = useState<"small" | "medium" | "large">("medium")
  const [shareLink, setShareLink] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)
  const markdown = useVideoStore((state) => state.markdown)

  const embedSizes = {
    small: { width: 560, height: 315 },
    medium: { width: 853, height: 480 },
    large: { width: 1280, height: 720 },
  }

  // Generate a shareable link - encode markdown as base64 or use Redis
  const generateShareLink = async () => {
    try {
      const encoded = btoa(encodeURIComponent(markdown))
      if (encoded.length > 2000) {
        // Store in Redis for large projects
        try {
          const response = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markdown }),
          })
          if (response.ok) {
            const { projectId } = await response.json()
            return `${typeof window !== "undefined" ? window.location.origin : ""}/editor?project=${projectId}`
          }
        } catch (error) {
          console.error("Failed to store in Redis:", error)
        }
        return `${typeof window !== "undefined" ? window.location.origin : ""}/editor?project=too-large`
      }
      return `${typeof window !== "undefined" ? window.location.origin : ""}/editor?md=${encoded.slice(0, 500)}`
    } catch {
      return `${typeof window !== "undefined" ? window.location.origin : ""}/editor`
    }
  }

  // Generate share link when modal opens
  useEffect(() => {
    if (open && typeof window !== "undefined") {
      setIsGenerating(true)
      generateShareLink().then((link) => {
        setShareLink(link)
        setIsGenerating(false)
      }).catch(() => {
        setShareLink(`${window.location.origin}/editor`)
        setIsGenerating(false)
      })
    } else if (!open) {
      // Reset when modal closes
      setShareLink("")
    }
  }, [open, markdown])

  const getEmbedCode = (width: number, height: number) => {
    return `<iframe src="${shareLink}&embed=true" width="${width}" height="${height}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`
  }

  const handleCopy = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleNativeShare = async () => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-800 text-gray-900 dark:text-neutral-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif font-semibold">
            Share Project
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-neutral-400">
            Share your project via link or embed it on your website
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="mt-4">
          <TabsList className="bg-gray-100 dark:bg-neutral-900 w-full">
            <TabsTrigger value="link" className="flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-gray-900 dark:data-[state=active]:text-neutral-100">
              <Link className="w-4 h-4 mr-2" />
              Share Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-gray-900 dark:data-[state=active]:text-neutral-100">
              <Code className="w-4 h-4 mr-2" />
              Embed Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600 dark:text-neutral-400">Project Link</Label>
              <div className="flex gap-2">
                <Input
                  value={isGenerating ? "Generating..." : shareLink}
                  readOnly
                  disabled={isGenerating}
                  className="bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-sm font-mono text-gray-900 dark:text-neutral-100"
                />
                <Button
                  onClick={() => handleCopy(shareLink, "link")}
                  variant="outline"
                  disabled={isGenerating || !shareLink}
                  className="border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 shrink-0"
                >
                  {copied === "link" ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

              <Button
                onClick={handleNativeShare}
              disabled={typeof window === "undefined" || !navigator.share}
              className="w-full gap-2 bg-gray-900 dark:bg-neutral-100 hover:bg-gray-800 dark:hover:bg-neutral-200 text-white dark:text-gray-900 border-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Share2 className="w-4 h-4" />
                Share via...
              </Button>

            <div className="bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-4 text-sm text-gray-600 dark:text-neutral-400">
              <p>
                Note: This creates a temporary link. For permanent sharing, export your project and host it yourself.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600 dark:text-neutral-400">Embed Size</Label>
              <div className="flex gap-2">
                {(Object.keys(embedSizes) as Array<keyof typeof embedSizes>).map((key) => (
                  <Button
                    key={key}
                    variant={embedSize === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEmbedSize(key)}
                    className={
                      embedSize === key
                        ? "bg-gray-900 dark:bg-neutral-100 text-white dark:text-gray-900"
                        : "bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
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
              <Label className="text-sm text-gray-600 dark:text-neutral-400">Embed Code</Label>
              <div className="relative overflow-hidden min-w-0">
                <pre className="bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg p-3 pr-12 text-xs font-mono text-gray-900 dark:text-neutral-100 break-all whitespace-pre-wrap w-full overflow-x-auto max-w-full">
                  {getEmbedCode(embedSizes[embedSize].width, embedSizes[embedSize].height)}
                </pre>
                <Button
                  onClick={() =>
                    handleCopy(getEmbedCode(embedSizes[embedSize].width, embedSizes[embedSize].height), "embed")
                  }
                  size="sm"
                  className="absolute top-2 right-2 h-7 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 z-10"
                >
                  {copied === "embed" ? <Check className="w-3 h-3 text-green-600 dark:text-green-400" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-gray-600 dark:text-neutral-400">Preview</Label>
              <div
                className="bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg overflow-hidden"
                style={{
                  aspectRatio: `${embedSizes[embedSize].width}/${embedSizes[embedSize].height}`,
                  maxHeight: 200,
                }}
              >
                {shareLink ? (
                  <iframe
                    src={`${shareLink}&embed=true`}
                    width="100%"
                    height="100%"
                    className="border-0"
                    style={{ minHeight: 200 }}
                    title="Embed Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-gray-500 dark:text-neutral-500 text-sm">Loading preview...</span>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
