"use client"

import { motion } from "framer-motion"
import { useState, useEffect, useMemo } from "react"

export function ParticleEffect({ type, intensity = "medium" }: { type: string; intensity?: "low" | "medium" | "high" }) {
  const [mounted, setMounted] = useState(false)
  const count = { low: 20, medium: 50, high: 100 }[intensity]

  useEffect(() => {
    setMounted(true)
  }, [])

  // Always call all hooks in the same order - compute all particle types upfront
  const baseParticles = useMemo(() => {
    if (!mounted) return []
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      size: 4 + Math.random() * 8,
    }))
  }, [count, mounted])

  const snowParticles = useMemo(() => {
    if (!mounted) return []
    return baseParticles.map((p) => ({
      ...p,
      top: 20 + Math.random() * 60,
    }))
  }, [baseParticles, mounted])

  const sparkleParticles = useMemo(() => {
    if (!mounted) return []
    return baseParticles.map((p) => ({
      ...p,
      top: 20 + Math.random() * 60,
      repeatDelay: Math.random() * 2,
    }))
  }, [baseParticles, mounted])

  if (!mounted) return null

  if (type === "confetti") {
    const colors = ["#f43f5e", "#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#ec4899"]
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {baseParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: -20,
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: colors[p.id % colors.length],
              borderRadius: 2,
            }}
            initial={{ y: -20, rotate: 0, opacity: 1 }}
            animate={{
              y: "120vh",
              rotate: 360 * (p.id % 2 === 0 ? 1 : -1),
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </div>
    )
  }

  if (type === "snow") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {snowParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.x}%`,
              top: `${p.top}%`,
              opacity: 0.8,
            }}
            animate={{
              y: "120vh",
              x: [0, 20, -20, 10, 0],
            }}
            transition={{
              duration: p.duration * 2,
              delay: p.delay,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </div>
    )
  }

  if (type === "sparkles") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {sparkleParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.top}%`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              delay: p.delay,
              repeat: Number.POSITIVE_INFINITY,
              repeatDelay: p.repeatDelay,
            }}
          >
            <svg width={p.size * 2} height={p.size * 2} viewBox="0 0 24 24" fill="none">
              <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" fill="#fbbf24" />
            </svg>
          </motion.div>
        ))}
      </div>
    )
  }

  return null
}
