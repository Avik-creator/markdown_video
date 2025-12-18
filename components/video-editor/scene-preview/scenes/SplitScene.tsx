"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/types";

export function SplitScene({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime: number;
}) {
  if (!scene.split) return null;

  const isVertical = scene.split.direction === "vertical";
  const ratio = scene.split.ratio || 0.5;

  return (
    <motion.div
      className={cn("flex h-full", isVertical ? "flex-col" : "flex-row")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="overflow-hidden"
        style={{
          [isVertical ? "height" : "width"]: `${ratio * 100}%`,
          backgroundColor: scene.split.left.background || "#1e1e2e",
        }}
      >
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <span>Left Panel (Time: {sceneTime.toFixed(2)}s)</span>
        </div>
      </div>
      <div className={cn("bg-white/10", isVertical ? "h-px" : "w-px")} />
      <div
        className="flex-1 overflow-hidden"
        style={{ backgroundColor: scene.split.right.background || "#1e1e2e" }}
      >
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <span>Right Panel (Time: {sceneTime.toFixed(2)}s)</span>
        </div>
      </div>
    </motion.div>
  );
}
