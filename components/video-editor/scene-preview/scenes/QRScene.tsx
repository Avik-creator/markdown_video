"use client"

import { motion } from "framer-motion"
import type { Scene } from "@/lib/types"

export function QRScene({ scene }: { scene: Scene }) {
  const qr = scene.qr
  if (!qr) return null

  // Generate QR code using a simple SVG pattern (simplified representation)
  const size = qr.size || 200
  const modules = 25
  const cellSize = size / modules

  // Simple deterministic pattern based on URL (not a real QR code, just visual representation)
  const generatePattern = (url: string) => {
    const pattern: boolean[][] = []
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      hash = (hash << 5) - hash + url.charCodeAt(i)
      hash = hash & hash
    }

    for (let y = 0; y < modules; y++) {
      pattern[y] = []
      for (let x = 0; x < modules; x++) {
        // Finder patterns (corners)
        const isFinderPattern = (x < 7 && y < 7) || (x >= modules - 7 && y < 7) || (x < 7 && y >= modules - 7)

        if (isFinderPattern) {
          const innerX = x % 7 < 7 ? x % 7 : (modules - 1 - x) % 7
          const innerY = y % 7 < 7 ? y % 7 : (modules - 1 - y) % 7
          const normalizedX = x < 7 ? innerX : x >= modules - 7 ? 6 - (x - (modules - 7)) : innerX
          const normalizedY = y < 7 ? innerY : y >= modules - 7 ? 6 - (y - (modules - 7)) : innerY

          pattern[y][x] =
            normalizedX === 0 ||
            normalizedX === 6 ||
            normalizedY === 0 ||
            normalizedY === 6 ||
            (normalizedX >= 2 && normalizedX <= 4 && normalizedY >= 2 && normalizedY <= 4)
        } else {
          // Data area - pseudo-random based on hash
          pattern[y][x] = (hash * (x + 1) * (y + 1)) % 3 === 0
        }
      }
    }
    return pattern
  }

  const pattern = generatePattern(qr.url)

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-4"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <motion.div
        className="p-4 bg-white rounded-xl shadow-xl"
        initial={{ rotateY: 90 }}
        animate={{ rotateY: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {pattern.map((row, y) =>
            row.map((cell, x) =>
              cell ? (
                <rect
                  key={`${x}-${y}`}
                  x={x * cellSize}
                  y={y * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill={qr.color || "#000000"}
                />
              ) : null,
            ),
          )}
        </svg>
      </motion.div>
      {qr.label && (
        <motion.p
          className="text-white text-lg font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {qr.label}
        </motion.p>
      )}
    </motion.div>
  )
}
