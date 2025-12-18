"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";

export function ParticleEffect({
  type,
  intensity = "medium",
}: {
  type: string;
  intensity?: "low" | "medium" | "high";
}) {
  const [mounted, setMounted] = useState(false);
  const count = { low: 20, medium: 50, high: 100 }[intensity];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Always call all hooks in the same order - compute all particle types upfront
  const baseParticles = useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      size: 4 + Math.random() * 8,
    }));
  }, [count, mounted]);

  const snowParticles = useMemo(() => {
    if (!mounted) return [];
    return baseParticles.map((p) => ({
      ...p,
      top: 20 + Math.random() * 60,
    }));
  }, [baseParticles, mounted]);

  const sparkleParticles = useMemo(() => {
    if (!mounted) return [];
    return baseParticles.map((p) => ({
      ...p,
      top: 20 + Math.random() * 60,
      repeatDelay: Math.random() * 2,
    }));
  }, [baseParticles, mounted]);

  if (!mounted) return null;

  if (type === "confetti") {
    const colors = [
      "#f43f5e",
      "#3b82f6",
      "#22c55e",
      "#eab308",
      "#8b5cf6",
      "#ec4899",
    ];
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
    );
  }

  if (type === "snow") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {baseParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.x}%`,
              top: -10,
              width: p.size,
              height: p.size,
              opacity: 0.8,
            }}
            initial={{ y: -10 }}
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
    );
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
            <svg
              width={p.size * 2}
              height={p.size * 2}
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z"
                fill="#fbbf24"
              />
            </svg>
          </motion.div>
        ))}
      </div>
    );
  }

  if (type === "rain") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {baseParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute bg-blue-400/60"
            style={{
              left: `${p.x}%`,
              top: -20,
              width: 2,
              height: 15 + Math.random() * 10,
              borderRadius: 2,
            }}
            initial={{ y: -20, opacity: 0.7 }}
            animate={{
              y: "120vh",
              opacity: [0.7, 0.7, 0],
            }}
            transition={{
              duration: p.duration * 0.5,
              delay: p.delay,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </div>
    );
  }

  if (type === "fireworks") {
    const colors = [
      "#f43f5e",
      "#3b82f6",
      "#22c55e",
      "#eab308",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
    ];
    const fireworkCount = Math.max(5, Math.floor(count / 5));
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: fireworkCount }).map((_, idx) => {
          const posX = 15 + (idx * 70) / fireworkCount + Math.random() * 10;
          const posY = 20 + Math.random() * 50;
          const delay = idx * 0.5 + Math.random() * 0.5;
          const color = colors[idx % colors.length];

          return (
            <motion.div
              key={idx}
              className="absolute"
              style={{
                left: `${posX}%`,
                top: `${posY}%`,
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{
                scale: [0, 1, 1, 0],
                opacity: [1, 1, 1, 0],
              }}
              transition={{
                duration: 1.5,
                delay: delay,
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 2,
                times: [0, 0.2, 0.8, 1],
              }}
            >
              {/* Firework burst particles */}
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * Math.PI * 2) / 12;
                const distance = 30 + Math.random() * 20;
                return (
                  <motion.div
                    key={i}
                    className="absolute"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: color,
                      boxShadow: `0 0 6px ${color}`,
                      left: -3,
                      top: -3,
                    }}
                    initial={{ x: 0, y: 0, scale: 1 }}
                    animate={{
                      x: [0, Math.cos(angle) * distance],
                      y: [0, Math.sin(angle) * distance],
                      scale: [1, 0.5],
                      opacity: [1, 0],
                    }}
                    transition={{
                      duration: 1,
                      delay: delay + 0.1,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 2 + 0.4,
                      ease: "easeOut",
                    }}
                  />
                );
              })}
            </motion.div>
          );
        })}
      </div>
    );
  }

  return null;
}
