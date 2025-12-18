"use client";

import { forwardRef } from "react";
import { useVideoStore } from "@/lib/use-video-store";
import type { Scene } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { transitionVariants } from "./scene-preview/utils/constants";

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
} from "./scene-preview/scenes";
import {
  ParticleEffect,
  CameraWrapper,
  CalloutOverlay,
  PresenterOverlay,
} from "./scene-preview/components";

// Scene router - routes to appropriate scene component based on scene type

import { animationVariants } from "./scene-preview/utils/constants";
import type { TimelineElement } from "@/lib/types";

// Timeline element renderer
function TimelineElementRenderer({
  element,
  sceneTime,
}: {
  element: TimelineElement;
  sceneTime: number;
}) {
  const isVisible =
    sceneTime >= element.at && sceneTime < element.at + element.duration;
  const variants =
    animationVariants[element.animation || "fadeIn"] ||
    animationVariants.fadeIn;

  if (!isVisible) return null;

  if (element.type === "text") {
    return (
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={{ duration: 0.3 }}
      >
        <span className="text-2xl font-bold text-white drop-shadow-lg">
          {element.content}
        </span>
      </motion.div>
    );
  }

  if (element.type === "emoji") {
    return (
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <span className="text-6xl">{element.content}</span>
      </motion.div>
    );
  }

  return null;
}

// Timeline elements overlay
function TimelineElementsOverlay({
  elements,
  sceneTime,
}: {
  elements: TimelineElement[];
  sceneTime: number;
}) {
  if (!elements || elements.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {elements.map((element) => (
          <TimelineElementRenderer
            key={element.id}
            element={element}
            sceneTime={sceneTime}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function SceneContentInner({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime: number;
}) {
  switch (scene.type) {
    case "text":
      return <TextScene scene={scene} />;
    case "code":
      return <CodeScene scene={scene} sceneTime={sceneTime} />;
    case "terminal":
      return <TerminalScene scene={scene} sceneTime={sceneTime} />;
    case "diff":
      return <DiffScene scene={scene} />;
    case "chart":
      return <ChartScene scene={scene} />;
    case "mockup":
      return <MockupScene scene={scene} />;
    case "split":
      return <SplitScene scene={scene} />;
    case "image":
      return <ImageScene scene={scene} />;
    case "emoji":
      return <EmojiScene scene={scene} />;
    case "qr":
      return <QRScene scene={scene} />;
    case "countdown":
      return <CountdownScene scene={scene} sceneTime={sceneTime} />;
    case "progress":
      return <ProgressScene scene={scene} sceneTime={sceneTime} />;
    default:
      return <TextScene scene={scene} />;
  }
}

function SceneContent({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime: number;
}) {
  const transition = scene.transition || "fade";
  const variants = transitionVariants[transition] || transitionVariants.fade;

  return (
    <motion.div
      className="absolute inset-0"
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
      transition={variants.transition}
    >
      <SceneContentInner scene={scene} sceneTime={sceneTime} />
    </motion.div>
  );
}

export const ScenePreview = forwardRef<HTMLDivElement, object>(
  function ScenePreview(_, ref) {
    const scenes = useVideoStore((state) => state.scenes);
    const currentTime = useVideoStore((state) => state.currentTime);
    const aspectRatio = useVideoStore((state) => state.aspectRatio);
    const zoom = useVideoStore((state) => state.zoom);

    const { currentScene, sceneTime } = useMemo(() => {
      let accumulatedTime = 0;
      for (let i = 0; i < scenes.length; i++) {
        const sceneDuration = scenes[i].duration;
        if (currentTime < accumulatedTime + sceneDuration) {
          return {
            currentScene: scenes[i],
            sceneTime: currentTime - accumulatedTime,
          };
        }
        accumulatedTime += sceneDuration;
      }
      return { currentScene: scenes[scenes.length - 1] || null, sceneTime: 0 };
    }, [scenes, currentTime]);

    const aspectRatioClass =
      {
        "16:9": "aspect-video",
        "9:16": "aspect-[9/16]",
        "1:1": "aspect-square",
        "4:3": "aspect-[4/3]",
      }[aspectRatio] || "aspect-video";

    if (!currentScene) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#0d0d12]">
          <p className="text-muted-foreground">No scenes to preview</p>
        </div>
      );
    }

    // Check if we're in an iframe (embed mode)
    const isEmbedded =
      typeof window !== "undefined" && window.self !== window.top;

    return (
      <div
        className={cn(
          "flex-1 flex items-center justify-center bg-[#0d0d12]",
          isEmbedded ? "p-2 overflow-auto" : "p-4 overflow-hidden"
        )}
      >
        <div
          ref={ref}
          data-scene-preview="true"
          className={cn(
            "relative w-full rounded-lg overflow-hidden shadow-2xl transition-transform",
            aspectRatioClass,
            isEmbedded ? "max-w-full" : "max-w-4xl"
          )}
          style={{
            background: currentScene.background || "#1a1a24",
            transform: isEmbedded ? "scale(1)" : `scale(${zoom / 100})`,
            maxHeight:
              aspectRatio === "9:16"
                ? isEmbedded
                  ? "100%"
                  : "80vh"
                : isEmbedded
                ? "100%"
                : undefined,
            width: aspectRatio === "9:16" ? "auto" : undefined,
          }}
        >
          <CameraWrapper camera={currentScene.camera} sceneTime={sceneTime}>
            <AnimatePresence mode="wait">
              <SceneContent
                key={currentScene.id}
                scene={currentScene}
                sceneTime={sceneTime}
              />
            </AnimatePresence>
          </CameraWrapper>

          {/* Overlays */}
          {currentScene.particles && (
            <ParticleEffect
              type={currentScene.particles.type}
              intensity={currentScene.particles.intensity}
            />
          )}
          {currentScene.callout && (
            <CalloutOverlay callout={currentScene.callout} />
          )}
          {currentScene.presenter && (
            <PresenterOverlay presenter={currentScene.presenter} />
          )}
          {currentScene.emoji &&
            !["text", "code", "terminal"].includes(currentScene.type) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <EmojiScene scene={currentScene} />
              </div>
            )}
          {/* Timeline elements */}
          {currentScene.timelineElements &&
            currentScene.timelineElements.length > 0 && (
              <TimelineElementsOverlay
                elements={currentScene.timelineElements}
                sceneTime={sceneTime}
              />
            )}
        </div>
      </div>
    );
  }
);
