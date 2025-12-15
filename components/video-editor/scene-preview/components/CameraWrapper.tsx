"use client";

import { motion } from "framer-motion";
import type { Scene } from "@/lib/types";

export function CameraWrapper({
  children,
  camera,
  sceneTime = 0,
}: {
  children: React.ReactNode;
  camera?: Scene["camera"];
  sceneTime?: number;
}) {
  if (!camera) return <>{children}</>;

  // Handle keyframe-based camera
  if (camera.keyframes && camera.keyframes.length > 0) {
    // Find current and next keyframe
    let currentKeyframe = camera.keyframes[0];
    let nextKeyframe = camera.keyframes[0];

    for (let i = 0; i < camera.keyframes.length; i++) {
      if (camera.keyframes[i].at <= sceneTime) {
        currentKeyframe = camera.keyframes[i];
        nextKeyframe = camera.keyframes[i + 1] || camera.keyframes[i];
      }
    }

    // Calculate interpolation
    const timeDiff = nextKeyframe.at - currentKeyframe.at;
    const progress =
      timeDiff > 0 ? (sceneTime - currentKeyframe.at) / timeDiff : 0;
    const clampedProgress = Math.max(0, Math.min(1, progress));

    // Interpolate zoom
    const currentZoom = currentKeyframe.zoom || 1;
    const nextZoom = nextKeyframe.zoom || 1;
    const zoom = currentZoom + (nextZoom - currentZoom) * clampedProgress;

    // Pan animation
    const panAmount = currentKeyframe.panAmount || 50;
    const panMap: Record<string, number> = {
      left: -panAmount,
      right: panAmount,
      up: 0,
      down: 0,
    };
    const panX = currentKeyframe.pan ? panMap[currentKeyframe.pan] || 0 : 0;
    const panY =
      currentKeyframe.pan === "down"
        ? panAmount
        : currentKeyframe.pan === "up"
        ? -panAmount
        : 0;

    // Shake animation
    const shakeIntensity =
      currentKeyframe.shakeIntensity === "high"
        ? 10
        : currentKeyframe.shakeIntensity === "medium"
        ? 5
        : 2;
    const shakeX = currentKeyframe.shake
      ? [0, -shakeIntensity, shakeIntensity, -shakeIntensity, shakeIntensity, 0]
      : 0;
    const shakeY = currentKeyframe.shake
      ? [0, shakeIntensity, -shakeIntensity, shakeIntensity, -shakeIntensity, 0]
      : 0;

    return (
      <motion.div
        className="w-full h-full origin-center"
        animate={{
          scale: zoom,
          x: panX + (Array.isArray(shakeX) ? 0 : shakeX),
          y: panY + (Array.isArray(shakeY) ? 0 : shakeY),
        }}
        transition={{ duration: 0.05, ease: "linear" }}
      >
        {children}
      </motion.div>
    );
  }

  // Fallback to simple camera effect
  const variants = {
    zoom: {
      animate: { scale: camera.value || 1.5 },
    },
    pan: {
      animate: { x: (camera.value || 1) * 50 },
    },
    shake: {
      animate: {
        x: [0, -5, 5, -5, 5, 0],
        y: [0, 5, -5, 5, -5, 0],
      },
    },
  };

  return (
    <motion.div
      className="w-full h-full"
      animate={variants[camera.effect]?.animate}
      transition={{ duration: camera.duration || 1, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
