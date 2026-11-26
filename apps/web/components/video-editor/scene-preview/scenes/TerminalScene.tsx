"use client";

import { motion, useAnimation } from "framer-motion";
import { useMemo, useEffect } from "react";
import type { Scene, TerminalCommand } from "@markdown-video/core";
import { computeTerminalCommandStates } from "../utils/animation-math";
import { TypingCursor } from "../components/TypingCursor";

const EMPTY_TERMINAL_COMMANDS: TerminalCommand[] = [];

export function TerminalScene({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime: number;
}) {
  const commands = scene.terminal?.commands ?? EMPTY_TERMINAL_COMMANDS;
  const typing = scene.terminal?.typing !== false;
  const speed = scene.terminal?.typingSpeed || 30;
  const controls = useAnimation();

  // Deterministic entrance driven by sceneTime.
  useEffect(() => {
    const progress = Math.min(sceneTime / 0.5, 1);
    controls.set({
      opacity: progress,
      y: 20 * (1 - progress),
    });
  }, [sceneTime, controls]);

  // Typing state and output fades are pure functions of sceneTime, so the
  // preview and the exporter render identical frames.
  const commandStates = useMemo(
    () => computeTerminalCommandStates(commands, sceneTime, speed, typing),
    [commands, sceneTime, speed, typing]
  );

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
            const state = commandStates[index];
            if (!state?.started) return null;

            const commandText = cmd.command.slice(0, state.commandChars);

            return (
              <div key={index} className="mb-3">
                <div className="flex items-start">
                  <span className="text-green-400 mr-2">
                    {cmd.prompt || "$"}
                  </span>
                  <span className="text-gray-100">
                    {commandText}
                    {state.typing && (
                      <TypingCursor
                        sceneTime={sceneTime}
                        className="inline-block w-2 h-4 bg-gray-100 ml-0.5"
                      />
                    )}
                  </span>
                </div>
                {state.outputVisible && cmd.output && (
                  <div
                    className="text-gray-400 mt-1 whitespace-pre-wrap pl-4"
                    style={{ opacity: state.outputOpacity }}
                  >
                    {cmd.output}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
