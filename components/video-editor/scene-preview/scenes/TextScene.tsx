"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/types";
import { useTypingEffect } from "../hooks/useTypingEffect";
import { animationVariants, textSizeClasses } from "../utils/constants";

export function TextScene({ scene }: { scene: Scene }) {
  const animation = scene.text?.animation || "fadeIn";
  const variants = animationVariants[animation] || animationVariants.fadeIn;
  const stagger = scene.text?.stagger || 0; // Stagger delay in seconds

  // Typewriter effect
  const { displayedText } = useTypingEffect(
    scene.text?.content || "",
    30,
    animation === "typewriter"
  );

  const content =
    animation === "typewriter" ? displayedText : scene.text?.content;

  const transition =
    animation === "bounceIn"
      ? { type: "spring" as const, stiffness: 300, damping: 20 }
      : { duration: 0.5 };

  const textColor = scene.text?.color || "#ffffff";

  // Split content into lines for multi-line support
  const lines = content?.split("\n") || [];

  const fontFamilyStyles: Record<string, React.CSSProperties> = {
    serif: { fontFamily: "'Playfair Display', serif" },
    sans: { fontFamily: "'Inter', sans-serif" },
    mono: { fontFamily: "'IBM Plex Mono', monospace" },
    display: { fontFamily: "'Merriweather', serif" },
  };

  // If stagger is enabled, use container with staggerChildren
  if (stagger > 0) {
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

    // Child variants must use "hidden" and "visible" to work with staggerChildren
    const childVariants = {
      hidden: variants.initial,
      visible: {
        ...variants.animate,
        transition: transition,
      },
    };

    return (
      <motion.div
        className="flex items-center justify-center h-full p-8"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div
          className={cn(
            "font-bold text-center leading-tight drop-shadow-lg",
            textSizeClasses[scene.text?.size || "lg"]
          )}
          style={{
            color: textColor,
            ...fontFamilyStyles[scene.text?.fontFamily || "serif"],
          }}
        >
          {lines.map((line, index) => (
            <motion.div key={index} variants={childVariants}>
              {line}
              {animation === "typewriter" &&
                index === lines.length - 1 &&
                displayedText !== scene.text?.content && (
                  <span
                    className="inline-block w-1 h-[1em] ml-1 animate-pulse"
                    style={{ backgroundColor: textColor }}
                  />
                )}
            </motion.div>
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
      animate={variants.animate}
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
          ...fontFamilyStyles[scene.text?.fontFamily || "serif"],
        }}
      >
        {lines.map((line, index) => (
          <div key={index}>
            {line}
            {animation === "typewriter" &&
              index === lines.length - 1 &&
              displayedText !== scene.text?.content && (
                <span
                  className="inline-block w-1 h-[1em] ml-1 animate-pulse"
                  style={{ backgroundColor: textColor }}
                />
              )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
