"use client"

import { forwardRef } from "react"
import { useVideoStore } from "@/lib/use-video-store"
import type { Scene } from "@/lib/types"
import { AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useMemo } from "react"

// Import extracted scene components
import {
  TextScene,
  TerminalScene,
  CodeScene,
  DiffScene,
  ChartScene,
  MockupScene,
  SplitScene,
  ImageScene,
  EmojiScene,
  QRScene,
  CountdownScene,
  ProgressScene,
} from "./scene-preview/scenes"
import { ParticleEffect, CameraWrapper, CalloutOverlay, PresenterOverlay } from "./scene-preview/components"

// Scene router - routes to appropriate scene component based on scene type


function SceneContent({ scene, sceneTime }: { scene: Scene; sceneTime: number }) {
  switch (scene.type) {
    case "text":
      return <TextScene scene={scene} />
    case "code":
      return <CodeScene scene={scene} sceneTime={sceneTime} />
    case "terminal":
      return <TerminalScene scene={scene} sceneTime={sceneTime} />
    case "diff":
      return <DiffScene scene={scene} />
    case "chart":
      return <ChartScene scene={scene} />
    case "mockup":
      return <MockupScene scene={scene} />
    case "split":
      return <SplitScene scene={scene} />
    case "image":
      return <ImageScene scene={scene} />
    case "emoji":
      return <EmojiScene scene={scene} />
    case "qr":
      return <QRScene scene={scene} />
    case "countdown":
      return <CountdownScene scene={scene} sceneTime={sceneTime} />
    case "progress":
      return <ProgressScene scene={scene} sceneTime={sceneTime} />
    default:
      return <TextScene scene={scene} />
  }
}

export const ScenePreview = forwardRef<HTMLDivElement, object>(function ScenePreview(_, ref) {
  const scenes = useVideoStore((state) => state.scenes)
  const currentTime = useVideoStore((state) => state.currentTime)
  const aspectRatio = useVideoStore((state) => state.aspectRatio)
  const zoom = useVideoStore((state) => state.zoom)

  const { currentScene, sceneTime } = useMemo(() => {
    let accumulatedTime = 0
    for (let i = 0; i < scenes.length; i++) {
      const sceneDuration = scenes[i].duration
      if (currentTime < accumulatedTime + sceneDuration) {
        return {
          currentScene: scenes[i],
          sceneTime: currentTime - accumulatedTime,
        }
      }
      accumulatedTime += sceneDuration
    }
    return { currentScene: scenes[scenes.length - 1] || null, sceneTime: 0 }
  }, [scenes, currentTime])

  const aspectRatioClass =
    {
      "16:9": "aspect-video",
      "9:16": "aspect-[9/16]",
      "1:1": "aspect-square",
      "4:3": "aspect-[4/3]",
    }[aspectRatio] || "aspect-video"

  if (!currentScene) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d0d12]">
        <p className="text-muted-foreground">No scenes to preview</p>
      </div>
    )
  }

  // Check if we're in an iframe (embed mode)
  const isEmbedded = typeof window !== "undefined" && window.self !== window.top

  return (
    <div className={cn(
      "flex-1 flex items-center justify-center bg-[#0d0d12]",
      isEmbedded ? "p-2 overflow-auto" : "p-4 overflow-hidden"
    )}>
      <div
        ref={ref}
        className={cn(
          "relative w-full rounded-lg overflow-hidden shadow-2xl transition-transform",
          aspectRatioClass,
          isEmbedded ? "max-w-full" : "max-w-4xl"
        )}
        style={{
          background: currentScene.background || "#1a1a24",
          transform: isEmbedded ? "scale(1)" : `scale(${zoom / 100})`,
          maxHeight: aspectRatio === "9:16" ? (isEmbedded ? "100%" : "80vh") : (isEmbedded ? "100%" : undefined),
          width: aspectRatio === "9:16" ? "auto" : undefined,
        }}
      >
        <CameraWrapper camera={currentScene.camera}>
          <AnimatePresence mode="wait">
            <SceneContent key={currentScene.id} scene={currentScene} sceneTime={sceneTime} />
          </AnimatePresence>
        </CameraWrapper>

        {/* Overlays */}
        {currentScene.particles && (
          <ParticleEffect type={currentScene.particles.type} intensity={currentScene.particles.intensity} />
        )}
        {currentScene.callout && <CalloutOverlay callout={currentScene.callout} />}
        {currentScene.presenter && <PresenterOverlay presenter={currentScene.presenter} />}
        {currentScene.emoji && !["text", "code", "terminal"].includes(currentScene.type) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <EmojiScene scene={currentScene} />
          </div>
        )}
      </div>
    </div>
  )
})
