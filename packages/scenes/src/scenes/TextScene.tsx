"use client";

import { motion } from "framer-motion";
import { cn } from "../cn.js";
import type { Scene } from "@markdown-video/core";
import { useTypingEffect } from "../hooks/useTypingEffect.js";
import { animationVariants, textSizeClasses } from "../utils/constants.js";
import { interpolateVariantState } from "../utils/interpolate.js";
import { staggeredLineProgress } from "../utils/animation-math.js";
import { textFontFamilyStyles } from "../utils/fonts.js";
import { TypingCursor } from "../components/TypingCursor.js";

import { useAnimation } from "framer-motion";
import { useEffect, useMemo } from "react";
import { useSceneLocalization } from "../localization.js";
import {
  resolveEffectiveLocale,
  resolveSceneTextContent,
} from "@markdown-video/core";

// framer-motion's variant/target types use template-literal index signatures
// that plain records don't satisfy structurally; the values are always
// numbers or strings.
type VariantState = Record<string, any>;

/**
 * A single line of staggered text. In deterministic mode (sceneTime
 * provided) the line's animation state is a pure function of the line's
 * staggered progress, applied via controls.set — no wall-clock animation —
 * so preview and export render identical frames.
 */
function StaggeredLine({
  initial,
  animate,
  progress,
  deterministic,
  variants,
  children,
}: {
  initial: VariantState;
  animate: VariantState;
  progress: number;
  deterministic: boolean;
  variants?: {
    hidden: VariantState;
    visible: VariantState;
  };
  children: React.ReactNode;
}) {
  const controls = useAnimation();

  useEffect(() => {
    if (deterministic) {
      controls.set(interpolateVariantState(initial, animate, progress));
    }
  }, [deterministic, initial, animate, progress, controls]);

  return (
    <motion.div
      variants={variants}
      initial={deterministic ? initial : undefined}
      animate={deterministic ? controls : undefined}
    >
      {children}
    </motion.div>
  );
}

export function TextScene({
  scene,
  sceneTime,
  inheritedLocale,
}: {
  scene: Scene;
  sceneTime?: number;
  /** Locale inherited from a containing split/mockup scene when this scene has no override. */
  inheritedLocale?: string;
}) {
  const animation = scene.text?.animation || "fadeIn";
  const variants = animationVariants[animation] || animationVariants.fadeIn;
  const stagger = scene.text?.stagger || 0; // Stagger delay in seconds
  const controls = useAnimation();

  // Localization data arrives through React context rather than a global
  // store: the editor feeds its document/playback state in at the shell,
  // while headless hosts can pass parsed document values (or nothing) for
  // the same deterministic resolution chain.
  const { locales, strings, defaultLocale, activeLocale } =
    useSceneLocalization();

  // Resolution is render-time and deterministic: scene override first, then a
  // valid user selection, then the document default. The translation fallback
  // chain itself is documented and tested in lib/parser/i18n.ts.
  const effectiveLocale = resolveEffectiveLocale({
    sceneLocale: scene.locale ?? inheritedLocale,
    activeLocale,
    locales,
    defaultLocale,
  });
  const localizedContent = useMemo(() => {
    if (!scene.text) return "";
    return resolveSceneTextContent(scene.text, {
      strings,
      locale: effectiveLocale,
      defaultLocale,
    });
  }, [scene.text, strings, effectiveLocale, defaultLocale]);

  // Typewriter effect
  const { displayedText } = useTypingEffect(
    localizedContent,
    30,
    animation === "typewriter",
    sceneTime
  );

  const content =
    animation === "typewriter" ? displayedText : localizedContent;

  const transition =
    animation === "bounceIn"
      ? { type: "spring" as const, stiffness: 300, damping: 20 }
      : { duration: 0.5 };

  const textColor = scene.text?.color || "#ffffff";

  // Split content into lines for multi-line support
  const lines = content?.split("\n") || [];

  const fontFamilyStyles = textFontFamilyStyles;

  // Handle deterministic animation for export
  useEffect(() => {
    if (sceneTime !== undefined) {
      const duration = 0.5;
      const progress = Math.min(sceneTime / duration, 1);

      controls.set(
        interpolateVariantState(
          variants.initial as VariantState,
          variants.animate as VariantState,
          progress
        )
      );
    } else {
      controls.start(variants.animate);
    }
  }, [sceneTime, variants, controls]);

  const typewriterCursor = (index: number) =>
    animation === "typewriter" &&
    index === lines.length - 1 &&
    displayedText !== localizedContent && (
      <TypingCursor
        sceneTime={sceneTime}
        className="inline-block w-1 h-[1em] ml-1"
        style={{ backgroundColor: textColor }}
      />
    );

  // If stagger is enabled, each line reveals independently, offset by
  // index * stagger — mirroring framer-motion's staggerChildren/orchestration
  // as a pure function of sceneTime.
  if (stagger > 0) {
    // Child variants must use "hidden" and "visible" to work with staggerChildren
    const childVariants = {
      hidden: variants.initial as VariantState,
      visible: {
        ...(variants.animate as VariantState),
        transition: transition,
      },
    };

    const containerVariants = {
      hidden: { opacity: 1 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: stagger,
          delayChildren: 0.1,
        },
      },
    };

    return (
      <motion.div
        className="flex items-center justify-center h-full p-8"
        initial="hidden"
        animate={sceneTime !== undefined ? undefined : "visible"}
        variants={containerVariants}
      >
        <div
          className={cn(
            "font-bold text-center leading-tight drop-shadow-lg",
            textSizeClasses[scene.text?.size || "lg"]
          )}
          style={{
            color: textColor,
            ...fontFamilyStyles[scene.text?.fontFamily || "sans"],
          }}
        >
          {lines.map((line, index) => (
            <StaggeredLine
              key={index}
              initial={variants.initial as VariantState}
              animate={variants.animate as VariantState}
              progress={
                sceneTime !== undefined
                  ? staggeredLineProgress(sceneTime, index, stagger)
                  : 0
              }
              deterministic={sceneTime !== undefined}
              variants={childVariants}
            >
              {line}
              {typewriterCursor(index)}
            </StaggeredLine>
          ))}
        </div>
      </motion.div>
    );
  }

  // Normal animation without stagger
  return (
    <motion.div
      className="flex items-center justify-center h-full p-8"
      initial={variants.initial}
      animate={sceneTime !== undefined ? controls : variants.animate}
      exit={variants.exit}
      transition={transition}
    >
      <div
        className={cn(
          "font-bold text-center leading-tight drop-shadow-lg",
          textSizeClasses[scene.text?.size || "lg"]
        )}
        style={{
          color: textColor,
          ...fontFamilyStyles[scene.text?.fontFamily || "sans"],
        }}
      >
        {lines.map((line, index) => (
          <div key={index}>
            {line}
            {typewriterCursor(index)}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
