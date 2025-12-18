"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import type { Scene } from "@/lib/types";

export function ProgressScene({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime: number;
}) {
  const progressConfig = scene.progress;
  const controls = useAnimation();

  useEffect(() => {
    if (sceneTime !== undefined) {
      const progress = Math.min(sceneTime / 0.5, 1);
      controls.set({ opacity: progress, scale: 0.8 + 0.2 * progress });
    } else {
      controls.start({ opacity: 1, scale: 1 });
    }
  }, [sceneTime, controls]);

  if (!progressConfig) return null;

  const targetValue = progressConfig.value;
  const maxValue = progressConfig.max || 100;
  const animate = progressConfig.animate !== false;

  // Animate progress over scene duration
  const currentValue = animate
    ? Math.min(targetValue, (sceneTime / scene.duration) * targetValue * 2)
    : targetValue;

  const percentage = (currentValue / maxValue) * 100;

  if (progressConfig.style === "circle") {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - percentage / 100);

    return (
      <motion.div
        className="flex flex-col items-center justify-center h-full gap-4"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={controls}
        exit={{ opacity: 0, scale: 0.8 }}
      >
        <div className="relative">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="12"
            />
            <motion.circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={progressConfig.color || "#ec4899"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={
                sceneTime !== undefined
                  ? { strokeDashoffset }
                  : { strokeDashoffset }
              }
              transition={
                sceneTime !== undefined
                  ? { duration: 0 }
                  : { duration: 0.5, ease: "easeOut" }
              }
              transform="rotate(-90 90 90)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-white">
              {Math.round(currentValue)}%
            </span>
          </div>
        </div>
        {progressConfig.label && (
          <span className="text-lg text-white/80">{progressConfig.label}</span>
        )}
      </motion.div>
    );
  }

  if (progressConfig.style === "semicircle") {
    const radius = 80;
    const circumference = Math.PI * radius;
    const strokeDashoffset = circumference * (1 - percentage / 100);

    return (
      <motion.div
        className="flex flex-col items-center justify-center h-full gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="relative">
          <svg width="200" height="120" viewBox="0 0 200 120">
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <motion.path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={progressConfig.color || "#ec4899"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
            <span className="text-4xl font-bold text-white">
              {Math.round(currentValue)}%
            </span>
          </div>
        </div>
        {progressConfig.label && (
          <span className="text-lg text-white/80 mt-4">
            {progressConfig.label}
          </span>
        )}
      </motion.div>
    );
  }

  // Bar style (default)
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-6 px-16 w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {progressConfig.label && (
        <span className="text-2xl text-white font-medium">
          {progressConfig.label}
        </span>
      )}
      <div className="w-full max-w-xl">
        <div className="h-6 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: progressConfig.color || "#ec4899" }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-2 text-white/60 text-sm">
          <span>0</span>
          <span className="text-white font-medium text-lg">
            {Math.round(currentValue)}%
          </span>
          <span>{maxValue}</span>
        </div>
      </div>
    </motion.div>
  );
}
