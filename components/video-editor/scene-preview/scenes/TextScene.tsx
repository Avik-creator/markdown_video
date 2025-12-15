"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/types";
import { useTypingEffect } from "../hooks/useTypingEffect";
import { animationVariants, textSizeClasses } from "../utils/constants";

export function TextScene({ scene }: { scene: Scene }) {
  const animation = scene.text?.animation || "fadeIn";
  const variants = animationVariants[animation] || animationVariants.fadeIn;

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

  const fontFamilyClasses: Record<string, string> = {
    serif: "font-serif",
    sans: "font-sans",
    mono: "font-mono",
    display: "font-serif",
  };

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
          textSizeClasses[scene.text?.size || "lg"],
          fontFamilyClasses[scene.text?.fontFamily || "serif"]
        )}
        style={{ color: textColor }}
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
