"use client";

import { forwardRef, useEffect, type CSSProperties } from "react";
import { motion, useAnimation } from "framer-motion";
import type { Scene } from "@markdown-video/core";
import {
  LOGICAL_ROOT_FONT_SIZE_PX,
  getRenderLayoutDimensions,
} from "@markdown-video/core";
import { cn } from "../cn.js";
import { transitionVariants } from "../utils/constants.js";
import { interpolateVariantState } from "../utils/interpolate.js";
import {
  normalizeTransitionDuration,
  transitionProgress,
} from "../utils/transition.js";
import { CameraWrapper } from "../components/CameraWrapper.js";
import { ParticleEffect } from "../components/ParticleEffect.js";
import { CalloutOverlay } from "../components/CalloutOverlay.js";
import { PresenterOverlay } from "../components/PresenterOverlay.js";
import { TimelineElementsOverlay } from "../components/TimelineElementsOverlay.js";
import { CaptionBurnOverlay } from "../components/CaptionBurnOverlay.js";
import type { CaptionCue } from "@markdown-video/core";
import { EmojiScene } from "../scenes/EmojiScene.js";
import { SceneRenderer } from "../scenes/SceneRenderer.js";
import {
  SceneLocalizationProvider,
  type SceneLocalization,
} from "../localization.js";
import {
  SceneSourceResolverProvider,
  type SceneSourceResolver,
} from "../source-resolution.js";

/**
 * Transition wrapper for one mounted scene.
 *
 * The entrance progress is driven purely by sceneTime: each frame writes the
 * interpolated variant state through controls.set, so there is no wall-clock
 * animation to diverge between preview, export and headless capture. The
 * controls.set runs in an effect, which is fine for every real consumer
 * (browser preview, export capture, Playwright screenshots all observe the
 * DOM after effects flush) — SSR markup keeps the variant's initial state,
 * matching the pre-extraction behavior exactly.
 *
 * There is deliberately no exit animation: it ran on wall-clock time, so
 * exports caught the previous scene mid-exit depending on capture speed. The
 * incoming scene's transition is driven by sceneTime instead.
 */
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
      <SceneRenderer scene={scene} sceneTime={sceneTime} />
    </motion.div>
  );
}

export interface SceneFrameCaptions {
  /**
   * Generated caption cues from @markdown-video/core caption generation.
   * Cue intervals are absolute video time, matching the sidecar serializers.
   */
  cues: readonly CaptionCue[];
  /**
   * Absolute video time in seconds. This is deliberately NOT sceneTime:
   * caption cues span scene boundaries, so the host must thread the same
   * absolute clock it uses to resolve the scene itself.
   */
  time: number;
}

export interface SceneFrameProps {
  /** The scene to compose. Use getSceneAtTime to derive it from a timeline. */
  scene: Scene;
  /** Time in seconds within the scene; drives all deterministic animation. */
  sceneTime: number;
  /**
   * Caption burn-in input. When present, the frame composites the active
   * cue as a DOM overlay inside the capture subtree, so capture pipelines
   * encode frames that already contain captions. When omitted (or when no
   * cue is active at the given time) the rendered DOM is identical to a
   * frame without captions — burn-in is strictly opt-in per frame.
   */
  captions?: SceneFrameCaptions | undefined;
  /**
   * Project aspect ratio key (for example "16:9" or "9:16"). The frame is
   * composed at the canonical logical size for the ratio — the short side is
   * always 1080 logical CSS pixels — so capture output never depends on the
   * on-screen size of the frame.
   */
  aspectRatio?: string;
  /**
   * Document-level localization data. When provided, the frame wraps its
   * content in the package's localization context; when omitted, whatever
   * context already exists above the frame applies.
   */
  localization?: SceneLocalization;
  /**
   * Optional host-owned media source mapping. Scene media receives the parsed
   * source text and renders the returned URL/path instead. The default is the
   * identity mapping, so hosts that do not need document-local media behavior
   * keep their existing semantics unchanged.
   */
  resolveSrc?: SceneSourceResolver;
  /**
   * Extra classes for the frame element. Positioning is host-owned: the
   * editor pins the frame absolutely inside its fit box, while a render page
   * can leave it in normal flow.
   */
  className?: string;
  /**
   * Extra styles for the frame element, merged after the logical-layout
   * base styles. Hosts use this for display transforms (the editor's
   * fit/zoom matrix) and visibility gating; capture machinery neutralizes
   * them in cloned output.
   */
  style?: CSSProperties;
}

/**
 * The logical-size scene composition root shared by every rendering host.
 *
 * This element is the capture contract: it carries data-scene-preview="true",
 * fixed logical dimensions, the logical root font size, and its own container
 * query context, and everything inside it — camera, transition layer, scene
 * content, overlays — is a deterministic function of (scene, sceneTime).
 * The editor preview scales this finished frame for display; export and
 * headless capture rasterize it directly.
 */
export const SceneFrame = forwardRef<HTMLDivElement, SceneFrameProps>(
  function SceneFrame(
    {
      scene,
      sceneTime,
      captions,
      aspectRatio,
      localization,
      resolveSrc,
      className,
      style,
    },
    ref
  ) {
    const logicalLayout = getRenderLayoutDimensions(aspectRatio);

    const content = (
      <>
        <CameraWrapper camera={scene.camera} sceneTime={sceneTime}>
          <SceneContent key={scene.id} scene={scene} sceneTime={sceneTime} />
        </CameraWrapper>

        {/* Overlays */}
        {scene.particles && (
          <ParticleEffect
            type={scene.particles.type}
            intensity={scene.particles.intensity}
            sceneTime={sceneTime}
          />
        )}
        {scene.callout && (
          <CalloutOverlay callout={scene.callout} sceneTime={sceneTime} />
        )}
        {scene.presenter && (
          <PresenterOverlay presenter={scene.presenter} sceneTime={sceneTime} />
        )}
        {scene.emoji && !["text", "code", "terminal"].includes(scene.type) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <EmojiScene scene={scene} sceneTime={sceneTime} />
          </div>
        )}
        {/* Timeline elements */}
        {scene.timelineElements && scene.timelineElements.length > 0 && (
          <TimelineElementsOverlay
            elements={scene.timelineElements}
            sceneTime={sceneTime}
          />
        )}
        {/* Burned-in captions composite last: subtitles belong on top of
            every other visual layer, including camera-transformed content. */}
        {captions && captions.cues.length > 0 && (
          <CaptionBurnOverlay cues={captions.cues} time={captions.time} />
        )}
      </>
    );

    return (
      <div
        ref={ref}
        data-scene-preview="true"
        className={cn(
          "rounded-lg overflow-hidden shadow-2xl",
          className
        )}
        style={{
          background: scene.background || "#1a1a24",
          width: logicalLayout.width,
          height: logicalLayout.height,
          fontSize: LOGICAL_ROOT_FONT_SIZE_PX,
          // Scene descendants using container-query units must resolve
          // against the logical frame, not the host layout. The frame has
          // fixed dimensions, so size containment cannot create a cyclic
          // content-size dependency here.
          containerType: "size",
          ...style,
        }}
      >
        <SceneSourceResolverProvider resolveSrc={resolveSrc}>
          {localization ? (
            <SceneLocalizationProvider value={localization}>
              {content}
            </SceneLocalizationProvider>
          ) : (
            content
          )}
        </SceneSourceResolverProvider>
      </div>
    );
  }
);
