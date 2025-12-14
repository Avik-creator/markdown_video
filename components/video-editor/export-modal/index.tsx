"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog"
import { Film } from "lucide-react"
import { useVideoStore } from "@/lib/use-video-store"
import { ExportPresets, ExportSettings, ExportProgress } from "./components"
import { useExport } from "./hooks/useExport"
import { loadPresets, savePresets, type ExportPreset } from "./utils/export-utils"

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewRef?: React.RefObject<HTMLDivElement | null>
}

export function ExportModal({ open, onOpenChange, previewRef }: ExportModalProps) {
  const totalDuration = useVideoStore((state) => state.totalDuration)
  const seekTo = useVideoStore((state) => state.seekTo)
  const pause = useVideoStore((state) => state.pause)

  const [format, setFormat] = useState("webm")
  const [resolution, setResolution] = useState("1080p")
  const [fps, setFps] = useState("30")
  const [quality, setQuality] = useState("balanced")

  const [presets, setPresets] = useState<ExportPreset[]>([])
  const [presetName, setPresetName] = useState("")
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  const { status, progress, errorMessage, currentFrame, totalFrames, handleExport, handleCancel, reset } = useExport({
    previewRef,
    totalDuration,
    seekTo,
    pause,
    format,
    resolution,
    fps,
    quality,
  })

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

  const handleClose = () => {
    if (status === "preparing" || status === "rendering" || status === "encoding") {
      return
    }
    reset()
    setShowSavePreset(false)
    onOpenChange(false)
  }

  const handleTryAgain = () => {
    reset()
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
          <>
            <ExportPresets
              presets={presets}
              selectedPreset={selectedPreset}
              presetName={presetName}
              showSavePreset={showSavePreset}
              onLoadPreset={handleLoadPreset}
              onDeletePreset={handleDeletePreset}
              onSavePreset={handleSavePreset}
              onCancelSave={() => setShowSavePreset(false)}
              onStartSave={() => setShowSavePreset(true)}
              onPresetNameChange={setPresetName}
            />
            <ExportSettings
              quality={quality}
              resolution={resolution}
              fps={fps}
              totalDuration={totalDuration}
              onQualityChange={(v) => {
                setQuality(v)
                setSelectedPreset(null)
              }}
              onResolutionChange={(v) => {
                setResolution(v)
                setSelectedPreset(null)
              }}
              onFpsChange={(v) => {
                setFps(v)
                setSelectedPreset(null)
              }}
              onExport={handleExport}
            />
          </>
        )}

        {(status === "preparing" || status === "rendering" || status === "encoding" || status === "complete" || status === "error") && (
          <ExportProgress
            status={status}
            progress={progress}
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            errorMessage={errorMessage}
            onCancel={handleCancel}
            onClose={handleClose}
            onTryAgain={handleTryAgain}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
