"use client"

import { motion } from "framer-motion"
import type { Scene } from "@/lib/types"

export function CameraWrapper({ children, camera }: { children: React.ReactNode; camera?: Scene["camera"] }) {
  if (!camera) return <>{children}</>

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
  }

  return (
    <motion.div
      className="w-full h-full"
      animate={variants[camera.effect]?.animate}
      transition={{ duration: camera.duration || 1, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  )
}
