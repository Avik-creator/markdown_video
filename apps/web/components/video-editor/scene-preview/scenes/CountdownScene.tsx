"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import type { Scene } from "@markdown-video/core";
import { countdownDigitState, springProgress } from "@markdown-video/scenes";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Scale/opacity of the digit pop-in, derived purely from the time since the
 * digit appeared. Uses the same spring physics as the original wall-clock
 * framer-motion spring, so preview and export render identical frames.
 */
function digitPopStyle(
  timeSinceAppear: number,
  startScale: number,
  spring: { stiffness: number; damping: number }
): { opacity: number; transform: string } {
  const progress = springProgress(timeSinceAppear, spring);
  const scale = startScale + (1 - startScale) * progress;
  return {
    opacity: clamp01(progress),
    transform: `scale(${scale})`,
  };
}

export function CountdownScene({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime: number;
}) {
  const countdown = scene.countdown;
  const controls = useAnimation();

  // Deterministic entrance driven by sceneTime. Each style keeps the
  // entrance it was designed with: scale for circle, fade for minimal,
  // fade+rise for digital.
  useEffect(() => {
    const progress = clamp01(sceneTime / 0.5);
    if (countdown?.style === "minimal") {
      controls.set({ opacity: progress });
    } else if (countdown?.style === "circle") {
      controls.set({ opacity: progress, scale: 0.5 + 0.5 * progress });
    } else {
      controls.set({ opacity: progress, y: 20 * (1 - progress) });
    }
  }, [sceneTime, controls, countdown?.style]);

  if (!countdown) return null;

  const { remainingTime, timeSinceAppear } = countdownDigitState(
    sceneTime,
    countdown.from
  );
  const progress =
    countdown.from > 0 ? clamp01(sceneTime / countdown.from) : 1;

  if (countdown.style === "circle") {
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - (1 - progress));
    const pop = digitPopStyle(timeSinceAppear, 1.5, {
      stiffness: 300,
      damping: 20,
    });

    return (
      <motion.div
        className="flex items-center justify-center h-full"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={controls}
        exit={{ opacity: 0, scale: 0.5 }}
      >
        <div className="relative">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {/* Background circle */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="8"
            />
            {/* Progress circle — strokeDashoffset is a pure function of
                sceneTime, set directly so export frames match preview. */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={countdown.color || "#ec4899"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 100 100)"
            />
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={pop}
          >
            <span
              className="text-6xl font-bold"
              style={{ color: countdown.color || "#ec4899" }}
            >
              {remainingTime}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (countdown.style === "minimal") {
    const pop = digitPopStyle(timeSinceAppear, 2, {
      stiffness: 200,
      damping: 15,
    });

    return (
      <motion.div
        className="flex items-center justify-center h-full"
        initial={{ opacity: 0 }}
        animate={controls}
        exit={{ opacity: 0 }}
      >
        <span
          className="text-9xl font-light inline-block"
          style={{ color: countdown.color || "#ec4899", ...pop }}
        >
          {remainingTime}
        </span>
      </motion.div>
    );
  }

  // Digital style (default)
  const pop = digitPopStyle(timeSinceAppear, 1.2, {
    stiffness: 300,
    damping: 20,
  });

  return (
    <motion.div
      className="flex items-center justify-center h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={controls}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="bg-zinc-900/80 px-12 py-8 rounded-2xl border border-white/10">
        <div
          className="font-mono text-8xl font-bold tracking-wider"
          style={{ color: countdown.color || "#ec4899", ...pop }}
        >
          {String(remainingTime).padStart(2, "0")}
        </div>
      </div>
    </motion.div>
  );
}
