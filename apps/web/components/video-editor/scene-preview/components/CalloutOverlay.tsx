"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { SceneCallout } from "@/lib/types";

export function CalloutOverlay({
  callout,
  sceneTime,
}: {
  callout: SceneCallout;
  sceneTime: number;
}) {
  const styleColors = {
    info: { bg: "bg-blue-500", text: "text-blue-500" },
    warning: { bg: "bg-amber-500", text: "text-amber-500" },
    error: { bg: "bg-red-500", text: "text-red-500" },
    success: { bg: "bg-green-500", text: "text-green-500" },
  };

  const colors = styleColors[callout.style || "info"];
  const controls = useAnimation();
  const arrowControls = useAnimation();

  useEffect(() => {
    if (sceneTime !== undefined) {
      const progress = Math.min(Math.max((sceneTime - 0.3) / 0.3, 0), 1);
      controls.set({
        opacity: progress,
        y: 20 * (1 - progress),
      });

      // Floating animation
      const floatY = Math.sin(sceneTime * Math.PI * 2) * 2.5 - 2.5;
      arrowControls.set({ y: floatY });
    } else {
      controls.start({ opacity: 1, y: 0 });
      arrowControls.start({
        y: [0, -5, 0],
        transition: { repeat: Infinity, duration: 1 },
      });
    }
  }, [sceneTime, controls, arrowControls]);

  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={controls}
    >
      <motion.div
        className={cn(
          "w-0 h-0 border-l-[10px] border-r-[10px] border-b-[12px] border-transparent",
          colors.text
        )}
        style={{ borderBottomColor: "currentColor" }}
        animate={arrowControls}
      />
      <div
        className={cn(
          "px-4 py-2 rounded-lg text-white text-sm font-medium shadow-lg",
          colors.bg
        )}
      >
        {callout.text}
      </div>
    </motion.div>
  );
}
