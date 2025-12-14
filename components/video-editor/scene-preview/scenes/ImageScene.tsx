"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { Scene } from "@/lib/types"

export function ImageScene({ scene }: { scene: Scene }) {
  const image = scene.image
  if (!image) return null

  const fitClasses = {
    cover: "object-cover",
    contain: "object-contain",
    fill: "object-fill",
  }

  const positionClasses = {
    center: "object-center",
    top: "object-top",
    bottom: "object-bottom",
    left: "object-left",
    right: "object-right",
  }

  return (
    <motion.div
      className="flex items-center justify-center h-full w-full"
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
    >
      <img
        src={image.src || "/placeholder.svg?height=400&width=600&query=image"}
        alt={image.alt || "Scene image"}
        className={cn(
          "max-w-full max-h-full",
          fitClasses[image.fit || "contain"],
          positionClasses[image.position || "center"],
        )}
      />
    </motion.div>
  )
}
