"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
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
  const controls = useAnimation();

  useEffect(() => {
    if (!camera) return;

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
      let shakeX = 0;
      let shakeY = 0;
      if (currentKeyframe.shake) {
        const shakeIntensity =
          currentKeyframe.shakeIntensity === "high"
            ? 10
            : currentKeyframe.shakeIntensity === "medium"
            ? 5
            : 2;
        // Deterministic shake based on sceneTime
        shakeX = Math.sin(sceneTime * 50) * shakeIntensity;
        shakeY = Math.cos(sceneTime * 50) * shakeIntensity;
      }

      controls.set({
        scale: zoom,
        x: panX + shakeX,
        y: panY + shakeY,
      });
    } else {
      // Fallback to simple camera effect
      if (camera.effect === "zoom") {
        controls.set({ scale: camera.value || 1.5 });
      } else if (camera.effect === "pan") {
        controls.set({ x: (camera.value || 1) * 50 });
      } else if (camera.effect === "shake") {
        const shakeX = Math.sin(sceneTime * 50) * 5;
        const shakeY = Math.cos(sceneTime * 50) * 5;
        controls.set({ x: shakeX, y: shakeY });
      }
    }
  }, [camera, sceneTime, controls]);

  if (!camera) return <>{children}</>;

  return (
    <motion.div className="w-full h-full origin-center" animate={controls}>
      {children}
    </motion.div>
  );
}
