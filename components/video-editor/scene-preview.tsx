"use client";

import { forwardRef, useMemo, useEffect, useSyncExternalStore } from "react";
import { useVideoStore } from "@/lib/use-video-store";
import type { Scene } from "@/lib/types";
import { motion, useAnimation } from "framer-motion";
import { transitionVariants } from "./scene-preview/utils/constants";
import { interpolateVariantState } from "./scene-preview/utils/interpolate";
import {
  normalizeTransitionDuration,
  transitionProgress,
} from "./scene-preview/utils/transition";
import { cn } from "@/lib/utils";

// Import extracted scene components
import { EmojiScene, SceneRenderer } from "./scene-preview/scenes";
import {
  ParticleEffect,
  CameraWrapper,
  CalloutOverlay,
  PresenterOverlay,
  TimelineElementsOverlay,
} from "./scene-preview/components";

// Scene router - routes to appropriate scene component based on scene type

function SceneContentInner({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime: number;
}) {
  return <SceneRenderer scene={scene} sceneTime={sceneTime} />;
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
  const transitionDuration = normalizeTransitionDuration(
    scene.transitionDuration
  );
  const controls = useAnimation();

  useEffect(() => {
    if (sceneTime !== undefined) {
      const progress = transitionProgress(sceneTime, transitionDuration);

      // Interpolate each key deterministically from sceneTime. This handles
      // numbers, percent strings (slide) and numbers embedded in strings such
      // as clipPath inset() (wipe); incompatible shapes snap at the end.
      controls.set(
        interpolateVariantState(
          variants.initial as Record<string, unknown>,
          variants.animate as Record<string, unknown>,
          progress
        )
      );
    } else {
      controls.start(variants.animate);
    }
  }, [sceneTime, transitionDuration, variants, controls]);

  return (
    <motion.div
      className="absolute inset-0"
      initial={variants.initial}
      animate={controls}
      transition={
        transition === "none"
          ? variants.transition
          : { ...variants.transition, duration: transitionDuration }
      }
    >
      <SceneContentInner scene={scene} sceneTime={sceneTime} />
    </motion.div>
  );
}

// Frame embedding cannot change during the lifetime of a document, so there
// is no external event to subscribe to. useSyncExternalStore still gives us
// the correct hydration contract: the server snapshot is always false, while
// the client snapshot is checked after hydration instead of during the first
// render (which would make embedded and non-embedded markup mismatch).
function subscribeToFrameEmbedding() {
  return () => {};
}

function getEmbeddedClientSnapshot() {
  return typeof window !== "undefined" && window.self !== window.top;
}

function getEmbeddedServerSnapshot() {
  return false;
}

export const ScenePreview = forwardRef<HTMLDivElement, object>(
  function ScenePreview(_, ref) {
    const scenes = useVideoStore((state) => state.scenes);
    const currentTime = useVideoStore((state) => state.currentTime);
    const aspectRatio = useVideoStore((state) => state.aspectRatio);
    const zoom = useVideoStore((state) => state.zoom);
    const isEmbedded = useSyncExternalStore(
      subscribeToFrameEmbedding,
      getEmbeddedClientSnapshot,
      getEmbeddedServerSnapshot
    );

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
      isEmbedded ? "" : ", 56rem"
    })`;

    if (!currentScene) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#0d0d12]">
          <p className="text-muted-foreground">No scenes to preview</p>
        </div>
      );
    }

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
