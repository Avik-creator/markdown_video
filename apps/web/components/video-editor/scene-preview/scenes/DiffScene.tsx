"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/types";

export function DiffScene({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime?: number;
}) {
  const changes = scene.diff?.changes || [];
  const language = scene.diff?.language || "text";
  const controls = useAnimation();

  useEffect(() => {
    if (sceneTime !== undefined) {
      const duration = 0.3;
      const progress = Math.min(sceneTime / duration, 1);
      controls.set({
        opacity: progress,
        scale: 0.95 + 0.05 * progress,
      });
    } else {
      controls.start({ opacity: 1, scale: 1 });
    }
  }, [sceneTime, controls]);

  return (
    <motion.div
      className="flex items-center justify-center h-full p-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={controls}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div className="bg-[#1a1a24] rounded-xl w-full max-w-3xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Diff header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0f0f14] border-b border-white/10">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs text-gray-500 ml-2 font-mono">
            Changes · {language}
          </span>
        </div>

        {/* Diff content */}
        <div className="font-mono text-sm overflow-auto">
          {changes.map((line, index) => (
            <motion.div
              key={index}
              className={cn(
                "px-4 py-1 border-l-4 flex items-start",
                line.type === "add" &&
                  "bg-green-500/10 border-green-500 text-green-300",
                line.type === "remove" &&
                  "bg-red-500/10 border-red-500 text-red-300",
                line.type === "context" &&
                  "bg-transparent border-transparent text-gray-400"
              )}
              initial={{
                opacity: 0,
                x: line.type === "add" ? 20 : line.type === "remove" ? -20 : 0,
              }}
              animate={
                sceneTime !== undefined
                  ? {
                      opacity: sceneTime >= index * 0.05 ? 1 : 0,
                      x:
                        sceneTime >= index * 0.05
                          ? 0
                          : line.type === "add"
                          ? 20
                          : line.type === "remove"
                          ? -20
                          : 0,
                    }
                  : {
                      opacity: 1,
                      x: 0,
                    }
              }
              transition={
                sceneTime !== undefined
                  ? { duration: 0 }
                  : { delay: index * 0.05 }
              }
            >
              <span className="w-6 text-gray-600 select-none mr-2">
                {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
              </span>
              <span>{line.content}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
