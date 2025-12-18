"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/types";

export function PresenterOverlay({
  presenter,
  sceneTime,
}: {
  presenter: Scene["presenter"];
  sceneTime: number;
}) {
  if (!presenter) return null;

  const positionClasses = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  const sizeClasses = {
    sm: "w-20 h-20",
    md: "w-28 h-28",
    lg: "w-36 h-36",
  };

  const shapeClasses = {
    circle: "rounded-full",
    square: "rounded-none",
    rounded: "rounded-xl",
  };

  const controls = useAnimation();

  useEffect(() => {
    if (sceneTime !== undefined) {
      const progress = Math.min(Math.max((sceneTime - 0.3) / 0.5, 0), 1);
      controls.set({
        scale: progress,
        opacity: progress,
      });
    } else {
      controls.start({ scale: 1, opacity: 1 });
    }
  }, [sceneTime, controls]);

  return (
    <motion.div
      className={cn(
        "absolute bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-white/20 shadow-xl flex items-center justify-center overflow-hidden",
        positionClasses[presenter.position],
        sizeClasses[presenter.size || "md"],
        shapeClasses[presenter.shape || "circle"]
      )}
      initial={{ scale: 0, opacity: 0 }}
      animate={controls}
    >
      {/* Placeholder avatar */}
      <div className="text-gray-500 text-xs text-center">
        <svg
          className="w-10 h-10 mx-auto mb-1"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
        <span>Presenter</span>
      </div>
    </motion.div>
  );
}
