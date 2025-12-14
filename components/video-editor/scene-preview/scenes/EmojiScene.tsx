"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { Scene } from "@/lib/types"

export function EmojiScene({ scene }: { scene: Scene }) {
  const emoji = scene.emoji
  if (!emoji) return null

  const sizeClasses = {
    sm: "text-4xl",
    md: "text-6xl",
    lg: "text-8xl",
    xl: "text-9xl",
    "2xl": "text-[12rem]",
  }

  const animationVariants = {
    bounce: {
      animate: { y: [0, -30, 0] },
      transition: { repeat: Number.POSITIVE_INFINITY, duration: 0.8 },
    },
    spin: {
      animate: { rotate: 360 },
      transition: { repeat: Number.POSITIVE_INFINITY, duration: 2, ease: "linear" as const },
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
  }

  const anim = animationVariants[emoji.animate || "none"]

  return (
    <motion.div
      className="flex items-center justify-center h-full"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
    >
      <motion.span className={cn(sizeClasses[emoji.size || "xl"])} animate={anim.animate} transition={anim.transition}>
        {emoji.emoji}
      </motion.span>
    </motion.div>
  )
}
