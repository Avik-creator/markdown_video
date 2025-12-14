"use client"

import { Button } from "@components/ui/button"
import { Progress } from "@components/ui/progress"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"

type ExportStatus = "preparing" | "rendering" | "encoding" | "complete" | "error"

interface ExportProgressProps {
  status: ExportStatus
  progress: number
  currentFrame: number
  totalFrames: number
  errorMessage: string
  onCancel: () => void
  onClose: () => void
  onTryAgain: () => void
}

export function ExportProgress({
  status,
  progress,
  currentFrame,
  totalFrames,
  errorMessage,
  onCancel,
  onClose,
  onTryAgain,
}: ExportProgressProps) {
  if (status === "preparing" || status === "rendering" || status === "encoding") {
    return (
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
            onClick={onCancel}
            variant="outline"
            className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 bg-transparent"
          >
            Cancel
          </Button>
        )}
      </div>
    )
  }

  if (status === "complete") {
    return (
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

        <Button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white">
          Close
        </Button>
      </div>
    )
  }

  if (status === "error") {
    return (
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

        <Button onClick={onTryAgain} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white">
          Try Again
        </Button>
      </div>
    )
  }

  return null
}
