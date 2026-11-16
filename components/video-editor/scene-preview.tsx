"use client";

import { forwardRef, useMemo, useEffect } from "react";
import { useVideoStore } from "@/lib/use-video-store";
import type { Scene } from "@/lib/types";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { transitionVariants } from "./scene-preview/utils/constants";
import { cn } from "@/lib/utils";

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

  const controls = useAnimation();

  useEffect(() => {
    if (isVisible) {
      const elementTime = sceneTime - element.at;
      const progress = Math.min(elementTime / 0.3, 1); // 0.3s fade in

      if (element.animation === "slideUp") {
        controls.set({
          opacity: progress,
          y: 20 * (1 - progress),
        });
      } else if (element.animation === "slideDown") {
        controls.set({
          opacity: progress,
          y: -20 * (1 - progress),
        });
      } else if (element.animation === "slideLeft") {
        controls.set({
          opacity: progress,
          x: 20 * (1 - progress),
        });
      } else if (element.animation === "slideRight") {
        controls.set({
          opacity: progress,
          x: -20 * (1 - progress),
        });
      } else if (
        element.animation === "zoomIn" ||
        element.animation === "bounceIn"
      ) {
        controls.set({
          opacity: progress,
          scale: 0.8 + 0.2 * progress,
        });
      } else {
        // Default fadeIn
        controls.set({
          opacity: progress,
        });
      }
    }
  }, [isVisible, sceneTime, element, controls]);

  if (!isVisible) return null;

  if (element.type === "text") {
    return (
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={variants.initial}
        animate={controls}
        exit={variants.exit}
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
        animate={controls}
        exit={{ scale: 0, opacity: 0 }}
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
      return <TextScene scene={scene} sceneTime={sceneTime} />;
    case "code":
      return <CodeScene scene={scene} sceneTime={sceneTime} />;
    case "terminal":
      return <TerminalScene scene={scene} sceneTime={sceneTime} />;
    case "diff":
      return <DiffScene scene={scene} sceneTime={sceneTime} />;
    case "chart":
      return <ChartScene scene={scene} sceneTime={sceneTime} />;
    case "mockup":
      return <MockupScene scene={scene} sceneTime={sceneTime} />;
    case "split":
      return <SplitScene scene={scene} sceneTime={sceneTime} />;
    case "image":
      return <ImageScene scene={scene} sceneTime={sceneTime} />;
    case "emoji":
      return <EmojiScene scene={scene} sceneTime={sceneTime} />;
    case "qr":
      return <QRScene scene={scene} sceneTime={sceneTime} />;
    case "countdown":
      return <CountdownScene scene={scene} sceneTime={sceneTime} />;
    case "progress":
      return <ProgressScene scene={scene} sceneTime={sceneTime} />;
    default:
      return <TextScene scene={scene} sceneTime={sceneTime} />;
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
  const controls = useAnimation();

  useEffect(() => {
    if (sceneTime !== undefined) {
      const duration = 0.5;
      const progress = Math.min(sceneTime / duration, 1);

      const initial = variants.initial as any;
      const animate = variants.animate as any;

      const currentState: any = {};
      for (const key in animate) {
        if (
          typeof animate[key] === "number" &&
          typeof initial[key] === "number"
        ) {
          currentState[key] =
            initial[key] + (animate[key] - initial[key]) * progress;
        } else if (
          typeof animate[key] === "string" &&
          animate[key].includes("%") &&
          initial[key].includes("%")
        ) {
          const start = parseFloat(initial[key]);
          const end = parseFloat(animate[key]);
          currentState[key] = `${start + (end - start) * progress}%`;
        } else {
          currentState[key] = progress >= 1 ? animate[key] : initial[key];
        }
      }
      controls.set(currentState);
    } else {
      controls.start(variants.animate);
    }
  }, [sceneTime, variants, controls]);

  return (
    <motion.div
      className="absolute inset-0"
      initial={variants.initial}
      animate={controls}
      transition={variants.transition}
    >
      <SceneContentInner scene={scene} sceneTime={sceneTime} />
    </motion.div>
  );
}

// True when the editor is rendered inside an iframe (embed mode).
function isEmbeddedFrame() {
  return typeof window !== "undefined" && window.self !== window.top;
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

    const [ratioW, ratioH] =
      (
        {
          "16:9": [16, 9],
          "9:16": [9, 16],
          "1:1": [1, 1],
          "4:3": [4, 3],
        } as Record<string, [number, number]>
      )[aspectRatio] ?? [16, 9];

    // Fit the frame inside the preview area at any aspect ratio: as wide as
    // possible without exceeding the area's height. cqw/cqh are the
    // container's content box, set up by containerType below.
    const fitWidth = `min(100cqw, calc(100cqh * ${ratioW} / ${ratioH})${
      isEmbeddedFrame() ? "" : ", 56rem"
    })`;

    if (!currentScene) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#0d0d12]">
          <p className="text-muted-foreground">No scenes to preview</p>
        </div>
      );
    }

    const isEmbedded = isEmbeddedFrame();

    return (
      <div
        className={cn(
          "flex-1 min-h-0 min-w-0 flex items-center justify-center bg-[#0d0d12]",
          isEmbedded ? "p-2 overflow-auto" : "p-4 overflow-hidden"
        )}
        style={{ containerType: "size" }}
      >
        <div
          ref={ref}
          data-scene-preview="true"
          className={cn(
            "relative shrink-0 rounded-lg overflow-hidden shadow-2xl transition-transform"
          )}
          style={{
            background: currentScene.background || "#1a1a24",
            transform: isEmbedded ? "scale(1)" : `scale(${zoom / 100})`,
            width: fitWidth,
            aspectRatio: `${ratioW} / ${ratioH}`,
          }}
        >
          <CameraWrapper camera={currentScene.camera} sceneTime={sceneTime}>
            {/* No exit animation: it ran on wall-clock time, so exports caught
                the previous scene mid-exit depending on capture speed. The
                incoming scene's transition is driven by sceneTime instead. */}
            <SceneContent
              key={currentScene.id}
              scene={currentScene}
              sceneTime={sceneTime}
            />
          </CameraWrapper>

          {/* Overlays */}
          {currentScene.particles && (
            <ParticleEffect
              type={currentScene.particles.type}
              intensity={currentScene.particles.intensity}
              sceneTime={sceneTime}
            />
          )}
          {currentScene.callout && (
            <CalloutOverlay
              callout={currentScene.callout}
              sceneTime={sceneTime}
            />
          )}
          {currentScene.presenter && (
            <PresenterOverlay
              presenter={currentScene.presenter}
              sceneTime={sceneTime}
            />
          )}
          {currentScene.emoji &&
            !["text", "code", "terminal"].includes(currentScene.type) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <EmojiScene scene={currentScene} sceneTime={sceneTime} />
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
