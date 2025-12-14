"use client"

import { motion } from "framer-motion"
import type { Scene } from "@/lib/types"

export function CountdownScene({ scene, sceneTime }: { scene: Scene; sceneTime: number }) {
  const countdown = scene.countdown
  if (!countdown) return null

  const remainingTime = Math.max(0, countdown.from - Math.floor(sceneTime))
  const progress = sceneTime / countdown.from

  if (countdown.style === "circle") {
    const radius = 80
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference * (1 - (1 - progress))

    return (
      <motion.div
        className="flex items-center justify-center h-full"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
      >
        <div className="relative">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {/* Background circle */}
            <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
            {/* Progress circle */}
            <motion.circle
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
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.3 }}
            />
          </svg>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            key={remainingTime}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <span className="text-6xl font-bold" style={{ color: countdown.color || "#ec4899" }}>
              {remainingTime}
            </span>
          </motion.div>
        </div>
      </motion.div>
    )
  }

  if (countdown.style === "minimal") {
    return (
      <motion.div
        className="flex items-center justify-center h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.span
          key={remainingTime}
          className="text-9xl font-light"
          style={{ color: countdown.color || "#ec4899" }}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          {remainingTime}
        </motion.span>
      </motion.div>
    )
  }

  // Digital style (default)
  return (
    <motion.div
      className="flex items-center justify-center h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="bg-zinc-900/80 px-12 py-8 rounded-2xl border border-white/10">
        <motion.div
          key={remainingTime}
          className="font-mono text-8xl font-bold tracking-wider"
          style={{ color: countdown.color || "#ec4899" }}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {String(remainingTime).padStart(2, "0")}
        </motion.div>
      </div>
    </motion.div>
  )
}
