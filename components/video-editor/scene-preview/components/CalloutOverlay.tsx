"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { SceneCallout } from "@/lib/types"

export function CalloutOverlay({ callout }: { callout: SceneCallout }) {
  const styleColors = {
    info: { bg: "bg-blue-500", text: "text-blue-500" },
    warning: { bg: "bg-amber-500", text: "text-amber-500" },
    error: { bg: "bg-red-500", text: "text-red-500" },
    success: { bg: "bg-green-500", text: "text-green-500" },
  }

  const colors = styleColors[callout.style || "info"]

  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <motion.div
        className={cn("w-0 h-0 border-l-[10px] border-r-[10px] border-b-[12px] border-transparent", colors.text)}
        style={{ borderBottomColor: "currentColor" }}
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1 }}
      />
      <div className={cn("px-4 py-2 rounded-lg text-white text-sm font-medium shadow-lg", colors.bg)}>
        {callout.text}
      </div>
    </motion.div>
  )
}
