"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/types";

export function EmojiScene({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime?: number;
}) {
  const emoji = scene.emoji;
  const controls = useAnimation();

  useEffect(() => {
    if (sceneTime !== undefined) {
      const duration = 0.5; // spring duration approx
      const progress = Math.min(sceneTime / duration, 1);
      controls.set({
        opacity: progress,
        scale: progress,
      });
    } else {
      controls.start({ opacity: 1, scale: 1 });
    }
  }, [sceneTime, controls]);

  if (!emoji) return null;

  const sizeClasses = {
    sm: "text-4xl",
    md: "text-6xl",
    lg: "text-8xl",
    xl: "text-9xl",
    "2xl": "text-[12rem]",
  };

  const animationVariants = {
    bounce: {
      animate: { y: [0, -30, 0] },
      transition: { repeat: Number.POSITIVE_INFINITY, duration: 0.8 },
    },
    spin: {
      animate: { rotate: 360 },
      transition: {
        repeat: Number.POSITIVE_INFINITY,
        duration: 2,
        ease: "linear" as const,
      },
    },
    pulse: {
      animate: { scale: [1, 1.2, 1] },
      transition: { repeat: Number.POSITIVE_INFINITY, duration: 1 },
    },
    shake: {
      animate: { x: [-5, 5, -5, 5, 0] },
      transition: { repeat: Number.POSITIVE_INFINITY, duration: 0.5 },
    },
    none: {
      animate: {},
      transition: {},
    },
  };

  const anim = animationVariants[emoji.animate || "none"];

  return (
    <motion.div
      className="flex items-center justify-center h-full"
      initial={{ opacity: 0, scale: 0 }}
      animate={controls}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
    >
      <motion.span
        className={cn(sizeClasses[emoji.size || "xl"])}
        animate={
          sceneTime !== undefined
            ? emoji.animate === "spin"
              ? { rotate: (sceneTime * 180) % 360 }
              : emoji.animate === "pulse"
              ? { scale: 1 + Math.sin(sceneTime * Math.PI * 2) * 0.1 }
              : emoji.animate === "bounce"
              ? { y: Math.sin(sceneTime * Math.PI * 2.5) * -30 }
              : emoji.animate === "shake"
              ? { x: Math.sin(sceneTime * Math.PI * 8) * 5 }
              : {}
            : anim.animate
        }
        transition={sceneTime !== undefined ? { duration: 0 } : anim.transition}
      >
        {emoji.emoji}
      </motion.span>
    </motion.div>
  );
}
