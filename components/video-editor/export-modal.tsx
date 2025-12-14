"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Download, Settings, Loader2, CheckCircle2, AlertCircle, Film, Zap, Save, Trash2, Star } from "lucide-react"
import { useVideoStore } from "@/lib/use-video-store"

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewRef?: React.RefObject<HTMLDivElement | null>
}

type ExportStatus = "idle" | "preparing" | "rendering" | "encoding" | "complete" | "error"

interface ExportPreset {
  id: string
  name: string
  format: string
  resolution: string
  fps: string
  quality: string
}

const STORAGE_KEY = "markdown-video-export-presets"

function loadPresets(): ExportPreset[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function savePresets(presets: ExportPreset[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function ExportModal({ open, onOpenChange, previewRef }: ExportModalProps) {
  const totalDuration = useVideoStore((state) => state.totalDuration)
  const seekTo = useVideoStore((state) => state.seekTo)
  const pause = useVideoStore((state) => state.pause)

  const [format, setFormat] = useState("webm")
  const [resolution, setResolution] = useState("1080p")
  const [fps, setFps] = useState("30")
  const [quality, setQuality] = useState("balanced")
  const [status, setStatus] = useState<ExportStatus>("idle")
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")
  const [currentFrame, setCurrentFrame] = useState(0)
  const [totalFrames, setTotalFrames] = useState(0)

  const [presets, setPresets] = useState<ExportPreset[]>([])
  const [presetName, setPresetName] = useState("")
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const cancelledRef = useRef(false)

  useEffect(() => {
    setPresets(loadPresets())
  }, [])

  const handleSavePreset = () => {
    if (!presetName.trim()) return

    const newPreset: ExportPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      format,
      resolution,
      fps,
      quality,
    }

    const updated = [...presets, newPreset]
    setPresets(updated)
    savePresets(updated)
    setPresetName("")
    setShowSavePreset(false)
  }

  const handleLoadPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (preset) {
      setFormat(preset.format)
      setResolution(preset.resolution)
      setFps(preset.fps)
      setQuality(preset.quality)
      setSelectedPreset(presetId)
    }
  }

  const handleDeletePreset = (presetId: string) => {
    const updated = presets.filter((p) => p.id !== presetId)
    setPresets(updated)
    savePresets(updated)
    if (selectedPreset === presetId) {
      setSelectedPreset(null)
    }
  }

  const getResolutionDimensions = (res: string) => {
    switch (res) {
      case "720p":
        return { width: 1280, height: 720 }
      case "1080p":
        return { width: 1920, height: 1080 }
      case "1440p":
        return { width: 2560, height: 1440 }
      case "4k":
        return { width: 3840, height: 2160 }
      default:
        return { width: 1920, height: 1080 }
    }
  }

  const getQualitySettings = (q: string) => {
    switch (q) {
      case "fast":
        return {
          scale: 2, // Capture at 2x for crisp rendering
          captureInterval: 2, // Capture every 2nd frame
          bitrate: 12000000, // 12 Mbps
          waitTime: 50,
        }
      case "balanced":
        return {
          scale: 2, // Capture at 2x
          captureInterval: 1, // Capture every frame
          bitrate: 20000000, // 20 Mbps
          waitTime: 16,
        }
      case "quality":
        return {
          scale: 3, // Capture at 3x for ultra crisp
          captureInterval: 1, // Every frame
          bitrate: 40000000, // 40 Mbps for smooth gradients
          waitTime: 16,
        }
      default:
        return { scale: 2, captureInterval: 1, bitrate: 20000000, waitTime: 16 }
    }
  }

  const getMimeType = (fmt: string) => {
    if (fmt === "webm") {
      // Prefer VP9 for better quality
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
        return "video/webm;codecs=vp9,opus"
      }
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        return "video/webm;codecs=vp9"
      }
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
        return "video/webm;codecs=vp8"
      }
      return "video/webm"
    }
    return "video/webm"
  }

  const waitForNextFrame = useCallback(() => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    })
  }, [])

  const handleExport = async () => {
    if (!previewRef?.current) {
      setErrorMessage("Preview element not found")
      setStatus("error")
      return
    }

    setStatus("preparing")
    setProgress(0)
    setErrorMessage("")
    chunksRef.current = []
    cancelledRef.current = false

    try {
      const html2canvas = (await import("html2canvas-pro")).default

      pause()
      seekTo(0)

      // Wait for UI to settle
      await new Promise((resolve) => setTimeout(resolve, 500))

      const { width, height } = getResolutionDimensions(resolution)
      const frameRate = Number.parseInt(fps)
      const qualitySettings = getQualitySettings(quality)

      // Calculate total frames based on duration and frame rate
      const totalFrameCount = Math.ceil(totalDuration * frameRate)
      const captureFrameCount = Math.ceil(totalFrameCount / qualitySettings.captureInterval)
      setTotalFrames(captureFrameCount)

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true, // Reduce latency
      })

      if (!ctx) {
        throw new Error("Could not get canvas context")
      }

      // Enable high-quality rendering
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      const stream = canvas.captureStream(frameRate)
      const mimeType = getMimeType(format)

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`${format.toUpperCase()} format not supported. Try a different browser.`)
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: qualitySettings.bitrate,
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        if (cancelledRef.current) return

        setStatus("encoding")

        // Small delay to ensure all data is collected
        setTimeout(() => {
          const blob = new Blob(chunksRef.current, { type: mimeType })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `markdown-video-${Date.now()}.webm`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)

          setStatus("complete")
        }, 300)
      }

      mediaRecorder.onerror = () => {
        setErrorMessage("Recording failed")
        setStatus("error")
      }

      setStatus("rendering")
      mediaRecorder.start(100)

      // Calculate time per frame
      const msPerFrame = 1000 / frameRate

      for (let frameIndex = 0; frameIndex < captureFrameCount; frameIndex++) {
        if (cancelledRef.current) break

        // Calculate the actual time for this frame
        const currentTime = (frameIndex * qualitySettings.captureInterval * msPerFrame) / 1000
        seekTo(Math.min(currentTime, totalDuration))

        await waitForNextFrame()

        // Additional wait for DOM to update
        await new Promise((resolve) => setTimeout(resolve, qualitySettings.waitTime))

        try {
          const capturedCanvas = await html2canvas(previewRef.current, {
            backgroundColor: "#09090b",
            scale: qualitySettings.scale,
            logging: false,
            useCORS: true,
            allowTaint: true,
            removeContainer: true,
            imageTimeout: 0,
            windowWidth: previewRef.current.scrollWidth,
            windowHeight: previewRef.current.scrollHeight,
          })

          // Clear and draw with high quality
          ctx.fillStyle = "#09090b"
          ctx.fillRect(0, 0, width, height)

          const sourceAspect = capturedCanvas.width / capturedCanvas.height
          const targetAspect = width / height

          let drawWidth = width
          let drawHeight = height
          let drawX = 0
          let drawY = 0

          if (sourceAspect > targetAspect) {
            // Source is wider - fit to width
            drawWidth = width
            drawHeight = width / sourceAspect
            drawY = (height - drawHeight) / 2
          } else {
            // Source is taller - fit to height
            drawHeight = height
            drawWidth = height * sourceAspect
            drawX = (width - drawWidth) / 2
          }

          ctx.drawImage(capturedCanvas, drawX, drawY, drawWidth, drawHeight)

          if (qualitySettings.captureInterval > 1) {
            const holdTime = msPerFrame * (qualitySettings.captureInterval - 1)
            await new Promise((resolve) => setTimeout(resolve, holdTime))
          }
        } catch {
          // On capture error, just fill with background
          ctx.fillStyle = "#09090b"
          ctx.fillRect(0, 0, width, height)
        }

        setCurrentFrame(frameIndex + 1)
        setProgress(Math.round(((frameIndex + 1) / captureFrameCount) * 100))
      }

      if (!cancelledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        mediaRecorder.stop()
      }
    } catch (error) {
      console.error("Export error:", error)
      setErrorMessage(error instanceof Error ? error.message : "Export failed")
      setStatus("error")
    }
  }

  const handleCancel = () => {
    cancelledRef.current = true
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    setStatus("idle")
    setProgress(0)
  }

  const handleClose = () => {
    if (status === "preparing" || status === "rendering" || status === "encoding") {
      return
    }
    setStatus("idle")
    setProgress(0)
    setErrorMessage("")
    setShowSavePreset(false)
    onOpenChange(false)
  }

  useEffect(() => {
    return () => {
      cancelledRef.current = true
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const estimatedTime = () => {
    const frameRate = Number.parseInt(fps)
    const qualitySettings = getQualitySettings(quality)
    const frames = Math.ceil((totalDuration * frameRate) / qualitySettings.captureInterval)
    const msPerFrame = quality === "fast" ? 60 : quality === "balanced" ? 40 : 50
    const seconds = Math.ceil((frames * msPerFrame) / 1000)
    if (seconds < 60) return `~${seconds}s`
    return `~${Math.ceil(seconds / 60)}m`
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-pink-500" />
            Export Video
          </DialogTitle>
          <DialogDescription className="text-zinc-400">Configure and export your video</DialogDescription>
        </DialogHeader>

        {status === "idle" && (
          <div className="space-y-5 py-4">
            {presets.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-zinc-400 flex items-center gap-2">
                  <Star className="w-3.5 h-3.5" />
                  Saved Presets
                </Label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className={`group flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                        selectedPreset === preset.id
                          ? "bg-pink-500/20 text-pink-400 border border-pink-500/50"
                          : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600"
                      }`}
                      onClick={() => handleLoadPreset(preset.id)}
                    >
                      <span>{preset.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeletePreset(preset.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 ml-1 text-zinc-500 hover:text-red-400 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quality Preset */}
            <div className="space-y-2">
              <Label className="text-sm text-zinc-400 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" />
                Export Quality
              </Label>
              <Select
                value={quality}
                onValueChange={(v) => {
                  setQuality(v)
                  setSelectedPreset(null)
                }}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="fast" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                    Fast - Good quality, faster export
                  </SelectItem>
                  <SelectItem value="balanced" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                    Balanced - High quality, smooth playback
                  </SelectItem>
                  <SelectItem value="quality" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                    Ultra - Best quality, crisp output
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Resolution */}
            <div className="space-y-2">
              <Label className="text-sm text-zinc-400">Resolution</Label>
              <Select
                value={resolution}
                onValueChange={(v) => {
                  setResolution(v)
                  setSelectedPreset(null)
                }}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="720p" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                    720p (1280x720)
                  </SelectItem>
                  <SelectItem value="1080p" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                    1080p (1920x1080)
                  </SelectItem>
                  <SelectItem value="1440p" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                    1440p (2560x1440)
                  </SelectItem>
                  <SelectItem value="4k" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                    4K (3840x2160)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Frame Rate */}
            <div className="space-y-2">
              <Label className="text-sm text-zinc-400">Frame Rate</Label>
              <Select
                value={fps}
                onValueChange={(v) => {
                  setFps(v)
                  setSelectedPreset(null)
                }}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="24" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                    24 fps (Cinematic)
                  </SelectItem>
                  <SelectItem value="30" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                    30 fps (Standard)
                  </SelectItem>
                  <SelectItem value="60" className="text-zinc-300 focus:bg-zinc-700 focus:text-white">
                    60 fps (Smooth)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Info */}
            <div className="flex items-center justify-between text-sm bg-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <Settings className="w-4 h-4" />
                <span>Duration: {totalDuration.toFixed(1)}s</span>
              </div>
              <span className="text-zinc-400">Est. time: {estimatedTime()}</span>
            </div>

            {showSavePreset ? (
              <div className="flex gap-2">
                <Input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                />
                <Button
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  size="sm"
                  className="bg-pink-500 hover:bg-pink-600 text-white shrink-0"
                >
                  Save
                </Button>
                <Button
                  onClick={() => setShowSavePreset(false)}
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 shrink-0"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setShowSavePreset(true)}
                variant="outline"
                className="w-full gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                <Save className="w-4 h-4" />
                Save as Preset
              </Button>
            )}

            {/* Export button */}
            <Button onClick={handleExport} className="w-full gap-2 bg-pink-500 hover:bg-pink-600 text-white">
              <Download className="w-4 h-4" />
              Export Video
            </Button>
          </div>
        )}

        {(status === "preparing" || status === "rendering" || status === "encoding") && (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-medium">
                  {status === "preparing" && "Preparing..."}
                  {status === "rendering" && "Recording frames..."}
                  {status === "encoding" && "Finalizing..."}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  {status === "rendering" && `Frame ${currentFrame}/${totalFrames} (${progress}%)`}
                  {status === "encoding" && "Almost done..."}
                </p>
              </div>
            </div>

            {status === "rendering" && <Progress value={progress} className="h-2 bg-zinc-800" />}

            {status === "rendering" && (
              <Button
                onClick={handleCancel}
                variant="outline"
                className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 bg-transparent"
              >
                Cancel
              </Button>
            )}
          </div>
        )}

        {status === "complete" && (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-medium">Export Complete!</p>
                <p className="text-sm text-zinc-400 mt-1">Your video has been downloaded</p>
              </div>
            </div>

            <Button onClick={handleClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white">
              Close
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-medium">Export Failed</p>
                <p className="text-sm text-red-400 mt-1">{errorMessage}</p>
              </div>
            </div>

            <Button onClick={() => setStatus("idle")} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white">
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
