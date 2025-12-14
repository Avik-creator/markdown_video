"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { Scene } from "@/lib/types"

export function MockupScene({ scene }: { scene: Scene }) {
  const mockup = scene.mockup
  if (!mockup) return null

  const deviceStyles: Record<string, { width: string; aspect: string; borderRadius: string; bezel: string }> = {
    iphone: { width: "w-72", aspect: "aspect-[9/19.5]", borderRadius: "rounded-[2.5rem]", bezel: "p-3" },
    ipad: { width: "w-96", aspect: "aspect-[3/4]", borderRadius: "rounded-[1.5rem]", bezel: "p-4" },
    macbook: { width: "w-[32rem]", aspect: "aspect-[16/10]", borderRadius: "rounded-t-xl", bezel: "p-2" },
    browser: { width: "w-[32rem]", aspect: "aspect-video", borderRadius: "rounded-xl", bezel: "p-0" },
    android: { width: "w-72", aspect: "aspect-[9/19]", borderRadius: "rounded-3xl", bezel: "p-2" },
  }

  const style = deviceStyles[mockup.device] || deviceStyles.browser

  return (
    <motion.div
      className="flex items-center justify-center h-full p-8"
      initial={{ opacity: 0, y: 30, rotateX: -10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", damping: 20 }}
    >
      <div
        className={cn(
          style.width,
          style.aspect,
          style.borderRadius,
          "bg-gray-900 shadow-2xl border-4 border-gray-800 overflow-hidden relative",
        )}
      >
        {mockup.device === "browser" && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-gray-700 rounded-md px-3 py-1 text-xs text-gray-400">localhost:3000</div>
            </div>
          </div>
        )}

        {(mockup.device === "iphone" || mockup.device === "android") && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
        )}

        <div
          className={cn("h-full bg-white", style.bezel)}
          style={{ backgroundColor: mockup.content.background || "#ffffff" }}
        >
          {/* Content placeholder */}
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-sm">Content Preview</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
