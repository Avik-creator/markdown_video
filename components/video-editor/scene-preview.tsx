"use client";

import {
  forwardRef,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useVideoStore } from "@/lib/use-video-store";
import type { Scene } from "@/lib/types";
import { motion, useAnimation } from "framer-motion";
import { transitionVariants } from "./scene-preview/utils/constants";
import { interpolateVariantState } from "./scene-preview/utils/interpolate";
import {
  normalizeTransitionDuration,
  transitionProgress,
} from "./scene-preview/utils/transition";
import {
  LOGICAL_ROOT_FONT_SIZE_PX,
  getRenderLayoutDimensions,
  getSceneAspectRatioDimensions,
} from "./scene-preview/utils/render-layout";
import {
  calculatePreviewFitTransform,
  previewFitTransformToCss,
} from "./scene-preview/utils/preview-fit";
import { useMeasuredPreviewSize } from "./scene-preview/utils/use-measured-preview-size";
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

/**
 * Locate the scene shown at `currentTime` and the time within that scene.
 *
 * A time exactly on a scene boundary belongs to the NEXT scene at time 0 —
 * the strict inequality is what keeps a mid-video boundary from flashing the
 * end state of the previous scene. Only the end-of-video fallthrough differs:
 * when playback reaches (or passes) the total duration, the last scene is
 * pinned to its own end so completed-state rendering (finished animations,
 * final countdown values) does not snap back to the scene's beginning.
 */
export function getSceneAtTime(scenes: Scene[], currentTime: number) {
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
  const lastScene = scenes[scenes.length - 1];
  if (!lastScene) {
    return { currentScene: null, sceneTime: 0 };
  }
  return { currentScene: lastScene, sceneTime: lastScene.duration };
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

    const { currentScene, sceneTime } = useMemo(
      () => getSceneAtTime(scenes, currentTime),
      [scenes, currentTime]
    );

    const [ratioW, ratioH] = getSceneAspectRatioDimensions(aspectRatio);
    const logicalLayout = useMemo(
      () => getRenderLayoutDimensions(aspectRatio),
      [aspectRatio]
    );
    const { sizingElementRef, size: fittedSize } = useMeasuredPreviewSize(
      currentScene !== null
    );

    // Embed previews historically ignored the editor zoom control (which is
    // not available there), while editor zoom composes multiplicatively with
    // the fit scale around the center of the reserved display box.
    const fitTransform = useMemo(() => {
      if (!fittedSize) return null;
      return calculatePreviewFitTransform({
        fittedWidth: fittedSize.width,
        fittedHeight: fittedSize.height,
        logicalWidth: logicalLayout.width,
        logicalHeight: logicalLayout.height,
        zoomPercent: isEmbedded ? 100 : zoom,
      });
    }, [fittedSize, logicalLayout, isEmbedded, zoom]);

    // Fit the reserved display box inside the preview area. The editor uses
    // both container dimensions and keeps the historical 56rem cap. Embeds are
    // width-driven instead: their outer box may scroll vertically, so a short
    // iframe still gets the full embed width rather than side-letterboxing.
    // cqw/cqh are the container's content box, set up by containerType below.
    const fitWidth = isEmbedded
      ? "100cqw"
      : `min(100cqw, calc(100cqh * ${ratioW} / ${ratioH}), 56rem)`;

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
          "flex-1 min-h-0 min-w-0 flex bg-[#0d0d12]",
          isEmbedded
            ? "p-2 overflow-auto"
            : "items-center justify-center p-4 overflow-hidden"
        )}
        style={{ containerType: "size" }}
      >
        {/* This shell reserves exactly the on-screen fitted size in layout.
            The scene inside it is deliberately oversized: it is composed in
            the same logical coordinate space used by exports and then scaled
            down as a finished frame. */}
        <div
          ref={sizingElementRef}
          data-scene-preview-fit="true"
          className={cn("relative shrink-0", isEmbedded && "m-auto")}
          style={{
            width: fitWidth,
            aspectRatio: `${ratioW} / ${ratioH}`,
          }}
        >
          <div
            ref={ref}
            data-scene-preview="true"
            className="absolute left-0 top-0 rounded-lg overflow-hidden shadow-2xl"
            style={{
              background: currentScene.background || "#1a1a24",
              width: logicalLayout.width,
              height: logicalLayout.height,
              fontSize: LOGICAL_ROOT_FONT_SIZE_PX,
              // Scene descendants using container-query units must resolve
              // against the logical frame, not the editor shell. The frame has
              // fixed dimensions, so size containment cannot create a cyclic
              // content-size dependency here.
              containerType: "size",
              transform: fitTransform
                ? previewFitTransformToCss(fitTransform)
                : "none",
              transformOrigin: "0 0",
              // The first RO measurement normally happens in a layout effect
              // before paint. If it has not completed (or the box is currently
              // zero-sized), show nothing rather than flashing an unscaled
              // 1920px-wide composition inside the editor layout.
              visibility: fitTransform ? "visible" : "hidden",
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
      </div>
    );
  }
);
