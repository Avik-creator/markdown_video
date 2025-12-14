"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type React from "react"
import { getResolutionDimensions, getQualitySettings, getMimeType } from "../utils/export-utils"

export type ExportStatus = "idle" | "preparing" | "rendering" | "encoding" | "complete" | "error"

interface UseExportOptions {
  previewRef?: React.RefObject<HTMLDivElement | null>
  totalDuration: number
  seekTo: (time: number) => void
  pause: () => void
  format: string
  resolution: string
  fps: string
  quality: string
}

export function useExport({
  previewRef,
  totalDuration,
  seekTo,
  pause,
  format,
  resolution,
  fps,
  quality,
}: UseExportOptions) {
  const [status, setStatus] = useState<ExportStatus>("idle")
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")
  const [currentFrame, setCurrentFrame] = useState(0)
  const [totalFrames, setTotalFrames] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const cancelledRef = useRef(false)

  const waitForNextFrame = useCallback(() => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    })
  }, [])

  const handleExport = useCallback(async () => {
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
  }, [previewRef, totalDuration, seekTo, pause, format, resolution, fps, quality, waitForNextFrame])

  const handleCancel = useCallback(() => {
    cancelledRef.current = true
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
    }
    setStatus("idle")
    setProgress(0)
  }, [])

  const reset = useCallback(() => {
    setStatus("idle")
    setProgress(0)
    setErrorMessage("")
    setCurrentFrame(0)
    setTotalFrames(0)
  }, [])

  useEffect(() => {
    return () => {
      cancelledRef.current = true
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  return {
    status,
    progress,
    errorMessage,
    currentFrame,
    totalFrames,
    handleExport,
    handleCancel,
    reset,
  }
}
