"use client";

import { motion, useAnimation } from "framer-motion";
import { useMemo, useEffect } from "react";
import type { Scene } from "@/lib/types";

export function TerminalScene({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime: number;
}) {
  const commands = scene.terminal?.commands || [];
  const typing = scene.terminal?.typing !== false;
  const speed = scene.terminal?.typingSpeed || 30;
  const controls = useAnimation();

  // Handle deterministic animation for export
  useEffect(() => {
    if (sceneTime !== undefined) {
      const duration = 0.5;
      const progress = Math.min(sceneTime / duration, 1);

      controls.set({
        opacity: progress,
        y: 20 * (1 - progress),
      });
    } else {
      controls.start({ opacity: 1, y: 0 });
    }
  }, [sceneTime, controls]);

  // Calculate which commands and how much text to show based on sceneTime
  const { visibleCommands, currentTypingIndex, currentTypingProgress } =
    useMemo(() => {
      if (!typing) {
        return {
          visibleCommands: commands.length,
          currentTypingIndex: -1,
          currentTypingProgress: 1,
        };
      }

      const charsPerSecond = speed;
      let totalChars = 0;
      const charsSoFar = sceneTime * charsPerSecond;

      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const cmdLength = cmd.command.length + (cmd.output?.length || 0) + 20; // Add padding for delay

        if (charsSoFar <= totalChars + cmdLength) {
          const progress = (charsSoFar - totalChars) / cmdLength;
          return {
            visibleCommands: i,
            currentTypingIndex: i,
            currentTypingProgress: Math.min(1, Math.max(0, progress)),
          };
        }
        totalChars += cmdLength;
      }

      return {
        visibleCommands: commands.length,
        currentTypingIndex: -1,
        currentTypingProgress: 1,
      };
    }, [commands, sceneTime, speed, typing]);

  return (
    <motion.div
      className="flex items-center justify-center h-full p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={controls}
      exit={{ opacity: 0 }}
    >
      <div className="bg-[#0d0d0d] rounded-xl w-full max-w-3xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Terminal header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a1a] border-b border-white/10">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-gray-400 ml-2 font-mono">Terminal</span>
        </div>

        {/* Terminal content */}
        <div className="p-4 font-mono text-sm min-h-[200px] max-h-[400px] overflow-auto">
          {commands.map((cmd, index) => {
            if (index > visibleCommands && index !== currentTypingIndex)
              return null;

            const isCurrentlyTyping = index === currentTypingIndex;
            const commandText = isCurrentlyTyping
              ? cmd.command.slice(
                  0,
                  Math.floor(cmd.command.length * currentTypingProgress * 2)
                )
              : cmd.command;

            const showOutput =
              index < visibleCommands ||
              (isCurrentlyTyping && currentTypingProgress > 0.5);

            return (
              <div key={index} className="mb-3">
                <div className="flex items-start">
                  <span className="text-green-400 mr-2">
                    {cmd.prompt || "$"}
                  </span>
                  <span className="text-gray-100">
                    {commandText}
                    {isCurrentlyTyping && currentTypingProgress < 1 && (
                      <span className="inline-block w-2 h-4 bg-gray-100 ml-0.5 animate-pulse" />
                    )}
                  </span>
                </div>
                {showOutput && cmd.output && (
                  <motion.div
                    className="text-gray-400 mt-1 whitespace-pre-wrap pl-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    {cmd.output}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
