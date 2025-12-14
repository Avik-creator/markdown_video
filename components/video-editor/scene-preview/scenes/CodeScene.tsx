"use client"

import { motion } from "framer-motion"
import { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { Scene } from "@/lib/types"
import { highlightSyntax } from "../utils/code-highlighting"

function CodeBlock({
  code,
  language,
  highlight,
  typing,
  typingSpeed,
  sceneTime,
}: {
  code: string
  language: string
  highlight?: { lines: number[] }
  typing?: boolean
  typingSpeed?: number
  sceneTime?: number
}) {
  const displayCode = useMemo(() => {
    if (!typing || sceneTime === undefined) return code

    const charsToShow = Math.floor((sceneTime || 0) * (typingSpeed || 50))
    return code.slice(0, charsToShow)
  }, [code, typing, typingSpeed, sceneTime])

  const lines = displayCode.split("\n")
  const fullLines = code.split("\n")
  const highlightedLines = highlight?.lines || []

  const isFirstInRange = (lineNum: number) => {
    return highlightedLines.includes(lineNum) && !highlightedLines.includes(lineNum - 1)
  }
  const isLastInRange = (lineNum: number) => {
    return highlightedLines.includes(lineNum) && !highlightedLines.includes(lineNum + 1)
  }

  return (
    <div className="bg-[#1a1a24] rounded-xl p-6 font-mono text-sm overflow-auto max-w-3xl w-full shadow-2xl border border-white/10">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-gray-500 ml-2 font-sans">{language}</span>
      </div>

      <pre className="text-left">
        {fullLines.map((fullLine, index) => {
          const lineNum = index + 1
          const isHighlighted = highlightedLines.includes(lineNum)
          const isFirst = isFirstInRange(lineNum)
          const isLast = isLastInRange(lineNum)
          const displayLine = lines[index] || ""
          const isTyping = typing && index === lines.length - 1 && displayLine.length < fullLine.length

          return (
            <div
              key={index}
              className={cn(
                "px-3 -mx-3 transition-colors",
                isHighlighted && "bg-amber-500/15 border-l-2 border-amber-400",
                isFirst && "rounded-t-md pt-1",
                isLast && "rounded-b-md pb-1",
                index >= lines.length && "opacity-0",
              )}
            >
              <span className="inline-block w-8 text-gray-600 select-none text-right pr-4">{lineNum}</span>
              <span className="text-gray-300">
                {highlightSyntax(displayLine, language)}
                {isTyping && <span className="inline-block w-2 h-4 bg-gray-100 ml-0.5 animate-pulse" />}
              </span>
            </div>
          )
        })}
      </pre>
    </div>
  )
}

export function CodeScene({ scene, sceneTime }: { scene: Scene; sceneTime: number }) {
  if (!scene.code) return null

  return (
    <motion.div
      className="flex items-center justify-center h-full p-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      <CodeBlock
        code={scene.code.content}
        language={scene.code.language}
        highlight={scene.code.highlight}
        typing={scene.code.typing}
        typingSpeed={scene.code.typingSpeed}
        sceneTime={sceneTime}
      />
    </motion.div>
  )
}
