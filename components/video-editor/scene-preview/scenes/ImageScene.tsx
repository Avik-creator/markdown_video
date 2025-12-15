"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/types";

export function ImageScene({ scene }: { scene: Scene }) {
  const image = scene.image;
  if (!image) return null;

  const fitClasses = {
    cover: "object-cover",
    contain: "object-contain",
    fill: "object-fill",
  };

  const positionClasses = {
    center: "object-center",
    top: "object-top",
    bottom: "object-bottom",
    left: "object-left",
    right: "object-right",
  };

  return (
    <motion.div
      className="flex items-center justify-center h-full w-full p-4 overflow-hidden"
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4 }}
    >
      <img
        src={image.src || "/placeholder.svg?height=400&width=600&query=image"}
        alt={image.alt || "Scene image"}
        className={cn(
          "w-full h-full",
          fitClasses[image.fit || "contain"],
          positionClasses[image.position || "center"]
        )}
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      />
    </motion.div>
  );
}
