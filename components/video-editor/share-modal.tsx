"use client"

import { useState } from "react"
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
  const markdown = useVideoStore((state) => state.markdown)

  const embedSizes = {
    small: { width: 560, height: 315 },
    medium: { width: 853, height: 480 },
    large: { width: 1280, height: 720 },
  }

  // Generate a shareable link - encode markdown as base64
  const generateShareLink = () => {
    try {
      const encoded = btoa(encodeURIComponent(markdown))
      if (encoded.length > 2000) {
        return `${typeof window !== "undefined" ? window.location.origin : ""}/editor?project=too-large`
      }
      return `${typeof window !== "undefined" ? window.location.origin : ""}/editor?md=${encoded.slice(0, 500)}`
    } catch {
      return `${typeof window !== "undefined" ? window.location.origin : ""}/editor`
    }
  }

  const shareLink = generateShareLink()

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
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-pink-500" />
            Share Project
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Share your project via link or embed it on your website
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="mt-4">
          <TabsList className="bg-zinc-800 w-full">
            <TabsTrigger value="link" className="flex-1 data-[state=active]:bg-zinc-700">
              <Link className="w-4 h-4 mr-2" />
              Share Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex-1 data-[state=active]:bg-zinc-700">
              <Code className="w-4 h-4 mr-2" />
              Embed Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-zinc-400">Project Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="bg-zinc-800 border-zinc-700 text-sm font-mono text-zinc-300"
                />
                <Button
                  onClick={() => handleCopy(shareLink, "link")}
                  variant="outline"
                  className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 shrink-0"
                >
                  {copied === "link" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {typeof navigator !== "undefined" && navigator.share && (
              <Button
                onClick={handleNativeShare}
                className="w-full gap-2 bg-pink-500 hover:bg-pink-600 text-white border-0"
              >
                <Share2 className="w-4 h-4" />
                Share via...
              </Button>
            )}

            <div className="bg-zinc-800/50 rounded-lg p-4 text-sm text-zinc-400">
              <p>
                Note: This creates a temporary link. For permanent sharing, export your project and host it yourself.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-zinc-400">Embed Size</Label>
              <div className="flex gap-2">
                {(Object.keys(embedSizes) as Array<keyof typeof embedSizes>).map((key) => (
                  <Button
                    key={key}
                    variant={embedSize === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEmbedSize(key)}
                    className={
                      embedSize === key
                        ? "bg-pink-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
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
              <Label className="text-sm text-zinc-400">Embed Code</Label>
              <div className="relative overflow-hidden min-w-0">
                <pre className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 pr-12 text-xs font-mono text-zinc-300 break-all whitespace-pre-wrap w-full overflow-x-auto max-w-full">
                  {getEmbedCode(embedSizes[embedSize].width, embedSizes[embedSize].height)}
                </pre>
                <Button
                  onClick={() =>
                    handleCopy(getEmbedCode(embedSizes[embedSize].width, embedSizes[embedSize].height), "embed")
                  }
                  size="sm"
                  className="absolute top-2 right-2 h-7 bg-zinc-700 hover:bg-zinc-600 z-10"
                >
                  {copied === "embed" ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-zinc-400">Preview</Label>
              <div
                className="bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center"
                style={{
                  aspectRatio: `${embedSizes[embedSize].width}/${embedSizes[embedSize].height}`,
                  maxHeight: 200,
                }}
              >
                <span className="text-zinc-500 text-sm">Embed Preview</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
