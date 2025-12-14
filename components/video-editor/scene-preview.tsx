"use client"

import React from "react"
import { forwardRef } from "react"
import { useVideoStore } from "@/lib/use-video-store"
import type { Scene, SceneCallout } from "@/lib/types"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useMemo, useState, useEffect } from "react"

const textSizeClasses = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl",
  "2xl": "text-6xl",
}

const animationVariants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 50 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -50 },
  },
  slideDown: {
    initial: { opacity: 0, y: -50 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 50 },
  },
  slideLeft: {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  },
  slideRight: {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
  },
  bounceIn: {
    initial: { opacity: 0, scale: 0.3 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.3 },
    transition: { type: "spring" as const, stiffness: 300, damping: 20 },
  },
  typewriter: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
}

// Typing effect hook
function useTypingEffect(text: string, speed = 50, enabled = true) {
  const [displayedText, setDisplayedText] = useState("")
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text)
      setIsComplete(true)
      return
    }

    setDisplayedText("")
    setIsComplete(false)
    let index = 0

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1))
        index++
      } else {
        setIsComplete(true)
        clearInterval(interval)
      }
    }, 1000 / speed)

    return () => clearInterval(interval)
  }, [text, speed, enabled])

  return { displayedText, isComplete }
}

// Terminal component with typing animation
function TerminalScene({ scene, sceneTime }: { scene: Scene; sceneTime: number }) {
  const commands = scene.terminal?.commands || []
  const typing = scene.terminal?.typing !== false
  const speed = scene.terminal?.typingSpeed || 30

  // Calculate which commands and how much text to show based on sceneTime
  const { visibleCommands, currentTypingIndex, currentTypingProgress } = useMemo(() => {
    if (!typing) {
      return { visibleCommands: commands.length, currentTypingIndex: -1, currentTypingProgress: 1 }
    }

    const charsPerSecond = speed
    let totalChars = 0
    const charsSoFar = sceneTime * charsPerSecond

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]
      const cmdLength = cmd.command.length + (cmd.output?.length || 0) + 20 // Add padding for delay

      if (charsSoFar <= totalChars + cmdLength) {
        const progress = (charsSoFar - totalChars) / cmdLength
        return { visibleCommands: i, currentTypingIndex: i, currentTypingProgress: Math.min(1, Math.max(0, progress)) }
      }
      totalChars += cmdLength
    }

    return { visibleCommands: commands.length, currentTypingIndex: -1, currentTypingProgress: 1 }
  }, [commands, sceneTime, speed, typing])

  return (
    <motion.div
      className="flex items-center justify-center h-full p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
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
            if (index > visibleCommands && index !== currentTypingIndex) return null

            const isCurrentlyTyping = index === currentTypingIndex
            const commandText = isCurrentlyTyping
              ? cmd.command.slice(0, Math.floor(cmd.command.length * currentTypingProgress * 2))
              : cmd.command

            const showOutput = index < visibleCommands || (isCurrentlyTyping && currentTypingProgress > 0.5)

            return (
              <div key={index} className="mb-3">
                <div className="flex items-start">
                  <span className="text-green-400 mr-2">{cmd.prompt || "$"}</span>
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
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

// Diff view component
function DiffScene({ scene }: { scene: Scene }) {
  const changes = scene.diff?.changes || []
  const language = scene.diff?.language || "text"

  return (
    <motion.div
      className="flex items-center justify-center h-full p-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
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
          <span className="text-xs text-gray-500 ml-2 font-mono">Changes · {language}</span>
        </div>

        {/* Diff content */}
        <div className="font-mono text-sm overflow-auto">
          {changes.map((line, index) => (
            <motion.div
              key={index}
              className={cn(
                "px-4 py-1 border-l-4 flex items-start",
                line.type === "add" && "bg-green-500/10 border-green-500 text-green-300",
                line.type === "remove" && "bg-red-500/10 border-red-500 text-red-300",
                line.type === "context" && "bg-transparent border-transparent text-gray-400",
              )}
              initial={{ opacity: 0, x: line.type === "add" ? 20 : line.type === "remove" ? -20 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
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
  )
}

// Chart component
function ChartScene({ scene }: { scene: Scene }) {
  const chart = scene.chart
  if (!chart) return null

  const maxValue = Math.max(...chart.data.map((d) => d.value))
  const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"]

  return (
    <motion.div
      className="flex items-center justify-center h-full p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="bg-[#1a1a24] rounded-xl p-6 w-full max-w-2xl shadow-2xl border border-white/10">
        {chart.title && <h3 className="text-lg font-semibold text-white mb-6 text-center">{chart.title}</h3>}

        {chart.type === "bar" && (
          <div className="space-y-4">
            {chart.data.map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <span className="text-gray-300 w-24 text-sm truncate">{item.label}</span>
                <div className="flex-1 h-8 bg-[#0f0f14] rounded-lg overflow-hidden">
                  <motion.div
                    className="h-full rounded-lg flex items-center justify-end pr-2"
                    style={{ backgroundColor: item.color || colors[index % colors.length] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / maxValue) * 100}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
                  >
                    <span className="text-white text-sm font-medium">{item.value}</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(chart.type === "pie" || chart.type === "donut") && (
          <div className="flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-64 h-64">
              {chart.data.map((item, index) => {
                const total = chart.data.reduce((sum, d) => sum + d.value, 0)
                const startAngle = chart.data.slice(0, index).reduce((sum, d) => sum + (d.value / total) * 360, 0)
                const angle = (item.value / total) * 360

                const x1 = 50 + 40 * Math.cos((Math.PI * (startAngle - 90)) / 180)
                const y1 = 50 + 40 * Math.sin((Math.PI * (startAngle - 90)) / 180)
                const x2 = 50 + 40 * Math.cos((Math.PI * (startAngle + angle - 90)) / 180)
                const y2 = 50 + 40 * Math.sin((Math.PI * (startAngle + angle - 90)) / 180)
                const largeArc = angle > 180 ? 1 : 0

                return (
                  <motion.path
                    key={index}
                    d={
                      chart.type === "donut"
                        ? `M ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2}`
                        : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`
                    }
                    fill={chart.type === "donut" ? "none" : item.color || colors[index % colors.length]}
                    stroke={item.color || colors[index % colors.length]}
                    strokeWidth={chart.type === "donut" ? 12 : 0}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.15 }}
                  />
                )
              })}
            </svg>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-6">
          {chart.data.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color || colors[index % colors.length] }}
              />
              <span className="text-gray-400 text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// Device mockup component
function MockupScene({ scene }: { scene: Scene }) {
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

// Callout component
function CalloutOverlay({ callout }: { callout: SceneCallout }) {
  const arrowRotation = {
    up: "rotate-0",
    down: "rotate-180",
    left: "rotate-90",
    right: "-rotate-90",
  }

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

// Particle effects - client-only to avoid hydration errors
function ParticleEffect({ type, intensity = "medium" }: { type: string; intensity?: "low" | "medium" | "high" }) {
  const [mounted, setMounted] = useState(false)
  const count = { low: 20, medium: 50, high: 100 }[intensity]

  useEffect(() => {
    setMounted(true)
  }, [])

  // Always call all hooks in the same order - compute all particle types upfront
  const baseParticles = useMemo(() => {
    if (!mounted) return []
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      size: 4 + Math.random() * 8,
    }))
  }, [count, mounted])

  const snowParticles = useMemo(() => {
    if (!mounted) return []
    return baseParticles.map((p) => ({
      ...p,
      top: 20 + Math.random() * 60,
    }))
  }, [baseParticles, mounted])

  const sparkleParticles = useMemo(() => {
    if (!mounted) return []
    return baseParticles.map((p) => ({
      ...p,
      top: 20 + Math.random() * 60,
      repeatDelay: Math.random() * 2,
    }))
  }, [baseParticles, mounted])

  if (!mounted) return null

  if (type === "confetti") {
    const colors = ["#f43f5e", "#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#ec4899"]
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
    )
  }

  if (type === "snow") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {snowParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.x}%`,
              top: `${p.top}%`,
              opacity: 0.8,
            }}
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
    )
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
            <svg width={p.size * 2} height={p.size * 2} viewBox="0 0 24 24" fill="none">
              <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" fill="#fbbf24" />
            </svg>
          </motion.div>
        ))}
      </div>
    )
  }

  return null
}

// Camera effect wrapper
function CameraWrapper({ children, camera }: { children: React.ReactNode; camera?: Scene["camera"] }) {
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

// Presenter PiP overlay
function PresenterOverlay({ presenter }: { presenter: Scene["presenter"] }) {
  if (!presenter) return null

  const positionClasses = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  }

  const sizeClasses = {
    sm: "w-20 h-20",
    md: "w-28 h-28",
    lg: "w-36 h-36",
  }

  const shapeClasses = {
    circle: "rounded-full",
    square: "rounded-none",
    rounded: "rounded-xl",
  }

  return (
    <motion.div
      className={cn(
        "absolute bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-white/20 shadow-xl flex items-center justify-center overflow-hidden",
        positionClasses[presenter.position],
        sizeClasses[presenter.size || "md"],
        shapeClasses[presenter.shape || "circle"],
      )}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", delay: 0.3 }}
    >
      {/* Placeholder avatar */}
      <div className="text-gray-500 text-xs text-center">
        <svg className="w-10 h-10 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
        <span>Presenter</span>
      </div>
    </motion.div>
  )
}

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

function highlightSyntax(line: string, language: string): React.ReactNode {
  const keywords = [
    "import",
    "export",
    "from",
    "const",
    "let",
    "var",
    "function",
    "async",
    "await",
    "return",
    "if",
    "else",
    "for",
    "while",
    "class",
    "interface",
    "type",
    "new",
    "this",
    "true",
    "false",
    "null",
    "undefined",
  ]

  if (line.trim().startsWith("//")) {
    return <span className="text-emerald-400/70 italic">{line}</span>
  }

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  const stringRegex = /(['"`])(?:(?!\1)[^\\]|\\.)*\1/g
  let match
  let keyCounter = 0

  while ((match = stringRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      const keywordPart = highlightKeywords(line.slice(lastIndex, match.index), keywords)
      // Extract children if it's a fragment, otherwise use as-is
      const children = React.isValidElement(keywordPart) && keywordPart.type === React.Fragment
        ? React.Children.toArray((keywordPart as React.ReactElement<{ children?: React.ReactNode }>).props.children)
        : [keywordPart]

      children.forEach((child, idx) => {
        if (React.isValidElement(child)) {
          parts.push(React.cloneElement(child, { key: `syntax-${keyCounter++}-${idx}` }))
        } else {
          parts.push(
            <span key={`syntax-${keyCounter++}-${idx}`}>{child}</span>
          )
        }
      })
    }
    parts.push(
      <span key={`string-${keyCounter++}`} className="text-amber-300">
        {match[0]}
      </span>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < line.length) {
    const keywordPart = highlightKeywords(line.slice(lastIndex), keywords)
    // Extract children if it's a fragment, otherwise use as-is
    const children = React.isValidElement(keywordPart) && keywordPart.type === React.Fragment
      ? React.Children.toArray((keywordPart as React.ReactElement<{ children?: React.ReactNode }>).props.children)
      : [keywordPart]

    children.forEach((child, idx) => {
      if (React.isValidElement(child)) {
        parts.push(React.cloneElement(child, { key: `syntax-${keyCounter++}-${idx}` }))
      } else {
        parts.push(
          <span key={`syntax-${keyCounter++}-${idx}`}>{child}</span>
        )
      }
    })
  }

  return parts.length > 0 ? <>{parts}</> : highlightKeywords(line, keywords)
}

function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g")
  let lastIndex = 0
  let match
  let keyCounter = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textPart = text.slice(lastIndex, match.index)
      if (textPart) {
        parts.push(
          <span key={`text-${keyCounter++}`}>{textPart}</span>
        )
      }
    }
    parts.push(
      <span key={`keyword-${keyCounter++}`} className="text-purple-400 font-medium">
        {match[0]}
      </span>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    const textPart = text.slice(lastIndex)
    if (textPart) {
      parts.push(
        <span key={`text-${keyCounter++}`}>{textPart}</span>
      )
    }
  }

  return parts.length > 0 ? <>{parts}</> : <span key="text-fallback">{text}</span>
}

function TextScene({ scene }: { scene: Scene }) {
  const animation = scene.text?.animation || "fadeIn"
  const variants = animationVariants[animation] || animationVariants.fadeIn

  // Typewriter effect
  const { displayedText } = useTypingEffect(scene.text?.content || "", 30, animation === "typewriter")

  const content = animation === "typewriter" ? displayedText : scene.text?.content

  const transition = animation === "bounceIn"
    ? { type: "spring" as const, stiffness: 300, damping: 20 }
    : { duration: 0.5 }

  return (
    <motion.div
      className="flex items-center justify-center h-full p-8"
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
      transition={transition}
    >
      <h1
        className={cn(
          "font-bold text-white text-center leading-tight drop-shadow-lg",
          textSizeClasses[scene.text?.size || "lg"],
        )}
      >
        {content}
        {animation === "typewriter" && displayedText !== scene.text?.content && (
          <span className="inline-block w-1 h-[1em] bg-white ml-1 animate-pulse" />
        )}
      </h1>
    </motion.div>
  )
}

function CodeScene({ scene, sceneTime }: { scene: Scene; sceneTime: number }) {
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

// Split layout scene
function SplitScene({ scene }: { scene: Scene }) {
  if (!scene.split) return null

  const isVertical = scene.split.direction === "vertical"
  const ratio = scene.split.ratio || 0.5

  return (
    <motion.div
      className={cn("flex h-full", isVertical ? "flex-col" : "flex-row")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="overflow-hidden"
        style={{
          [isVertical ? "height" : "width"]: `${ratio * 100}%`,
          backgroundColor: scene.split.left.background || "#1e1e2e",
        }}
      >
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <span>Left Panel</span>
        </div>
      </div>
      <div className={cn("bg-white/10", isVertical ? "h-px" : "w-px")} />
      <div className="flex-1 overflow-hidden" style={{ backgroundColor: scene.split.right.background || "#1e1e2e" }}>
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <span>Right Panel</span>
        </div>
      </div>
    </motion.div>
  )
}

function ImageScene({ scene }: { scene: Scene }) {
  const image = scene.image
  if (!image) return null

  const fitClasses = {
    cover: "object-cover",
    contain: "object-contain",
    fill: "object-fill",
  }

  const positionClasses = {
    center: "object-center",
    top: "object-top",
    bottom: "object-bottom",
    left: "object-left",
    right: "object-right",
  }

  return (
    <motion.div
      className="flex items-center justify-center h-full w-full"
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
    >
      <img
        src={image.src || "/placeholder.svg?height=400&width=600&query=image"}
        alt={image.alt || "Scene image"}
        className={cn(
          "max-w-full max-h-full",
          fitClasses[image.fit || "contain"],
          positionClasses[image.position || "center"],
        )}
      />
    </motion.div>
  )
}

function EmojiScene({ scene }: { scene: Scene }) {
  const emoji = scene.emoji
  if (!emoji) return null

  const sizeClasses = {
    sm: "text-4xl",
    md: "text-6xl",
    lg: "text-8xl",
    xl: "text-9xl",
    "2xl": "text-[12rem]",
  }

  const animationVariants = {
    bounce: {
      animate: { y: [0, -30, 0] },
      transition: { repeat: Number.POSITIVE_INFINITY, duration: 0.8 },
    },
    spin: {
      animate: { rotate: 360 },
      transition: { repeat: Number.POSITIVE_INFINITY, duration: 2, ease: "linear" as const },
    },
    pulse: {
      animate: { scale: [1, 1.2, 1] },
      transition: { repeat: Number.POSITIVE_INFINITY, duration: 1 },
    },
    shake: {
      animate: { x: [-5, 5, -5, 5, 0] },
      transition: { repeat: Number.POSITIVE_INFINITY, duration: 0.5 },
    },
    none: {
      animate: {},
      transition: {},
    },
  }

  const anim = animationVariants[emoji.animate || "none"]

  return (
    <motion.div
      className="flex items-center justify-center h-full"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
    >
      <motion.span className={cn(sizeClasses[emoji.size || "xl"])} animate={anim.animate} transition={anim.transition}>
        {emoji.emoji}
      </motion.span>
    </motion.div>
  )
}

function QRScene({ scene }: { scene: Scene }) {
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

function CountdownScene({ scene, sceneTime }: { scene: Scene; sceneTime: number }) {
  const countdown = scene.countdown
  if (!countdown) return null

  const remainingTime = Math.max(0, countdown.from - Math.floor(sceneTime))
  const progress = sceneTime / countdown.from

  if (countdown.style === "circle") {
    const radius = 80
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference * (1 - (1 - progress))

    return (
      <motion.div
        className="flex items-center justify-center h-full"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
      >
        <div className="relative">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {/* Background circle */}
            <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
            {/* Progress circle */}
            <motion.circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={countdown.color || "#ec4899"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 100 100)"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.3 }}
            />
          </svg>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            key={remainingTime}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <span className="text-6xl font-bold" style={{ color: countdown.color || "#ec4899" }}>
              {remainingTime}
            </span>
          </motion.div>
        </div>
      </motion.div>
    )
  }

  if (countdown.style === "minimal") {
    return (
      <motion.div
        className="flex items-center justify-center h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.span
          key={remainingTime}
          className="text-9xl font-light"
          style={{ color: countdown.color || "#ec4899" }}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          {remainingTime}
        </motion.span>
      </motion.div>
    )
  }

  // Digital style (default)
  return (
    <motion.div
      className="flex items-center justify-center h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="bg-zinc-900/80 px-12 py-8 rounded-2xl border border-white/10">
        <motion.div
          key={remainingTime}
          className="font-mono text-8xl font-bold tracking-wider"
          style={{ color: countdown.color || "#ec4899" }}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {String(remainingTime).padStart(2, "0")}
        </motion.div>
      </div>
    </motion.div>
  )
}

function ProgressScene({ scene, sceneTime }: { scene: Scene; sceneTime: number }) {
  const progressConfig = scene.progress
  if (!progressConfig) return null

  const targetValue = progressConfig.value
  const maxValue = progressConfig.max || 100
  const animate = progressConfig.animate !== false

  // Animate progress over scene duration
  const currentValue = animate ? Math.min(targetValue, (sceneTime / scene.duration) * targetValue * 2) : targetValue

  const percentage = (currentValue / maxValue) * 100

  if (progressConfig.style === "circle") {
    const radius = 70
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference * (1 - percentage / 100)

    return (
      <motion.div
        className="flex flex-col items-center justify-center h-full gap-4"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
      >
        <div className="relative">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
            <motion.circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={progressConfig.color || "#ec4899"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              transform="rotate(-90 90 90)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-white">{Math.round(currentValue)}%</span>
          </div>
        </div>
        {progressConfig.label && <span className="text-lg text-white/80">{progressConfig.label}</span>}
      </motion.div>
    )
  }

  if (progressConfig.style === "semicircle") {
    const radius = 80
    const circumference = Math.PI * radius
    const strokeDashoffset = circumference * (1 - percentage / 100)

    return (
      <motion.div
        className="flex flex-col items-center justify-center h-full gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="relative">
          <svg width="200" height="120" viewBox="0 0 200 120">
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <motion.path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={progressConfig.color || "#ec4899"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
            <span className="text-4xl font-bold text-white">{Math.round(currentValue)}%</span>
          </div>
        </div>
        {progressConfig.label && <span className="text-lg text-white/80 mt-4">{progressConfig.label}</span>}
      </motion.div>
    )
  }

  // Bar style (default)
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-6 px-16 w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {progressConfig.label && <span className="text-2xl text-white font-medium">{progressConfig.label}</span>}
      <div className="w-full max-w-xl">
        <div className="h-6 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: progressConfig.color || "#ec4899" }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-2 text-white/60 text-sm">
          <span>0</span>
          <span className="text-white font-medium text-lg">{Math.round(currentValue)}%</span>
          <span>{maxValue}</span>
        </div>
      </div>
    </motion.div>
  )
}

function SceneContent({ scene, sceneTime }: { scene: Scene; sceneTime: number }) {
  switch (scene.type) {
    case "text":
      return <TextScene scene={scene} />
    case "code":
      return <CodeScene scene={scene} sceneTime={sceneTime} />
    case "terminal":
      return <TerminalScene scene={scene} sceneTime={sceneTime} />
    case "diff":
      return <DiffScene scene={scene} />
    case "chart":
      return <ChartScene scene={scene} />
    case "mockup":
      return <MockupScene scene={scene} />
    case "split":
      return <SplitScene scene={scene} />
    case "image":
      return <ImageScene scene={scene} />
    case "emoji":
      return <EmojiScene scene={scene} />
    case "qr":
      return <QRScene scene={scene} />
    case "countdown":
      return <CountdownScene scene={scene} sceneTime={sceneTime} />
    case "progress":
      return <ProgressScene scene={scene} sceneTime={sceneTime} />
    default:
      return <TextScene scene={scene} />
  }
}

export const ScenePreview = forwardRef<HTMLDivElement, object>(function ScenePreview(_, ref) {
  const scenes = useVideoStore((state) => state.scenes)
  const currentTime = useVideoStore((state) => state.currentTime)
  const aspectRatio = useVideoStore((state) => state.aspectRatio)
  const zoom = useVideoStore((state) => state.zoom)

  const { currentScene, sceneTime } = useMemo(() => {
    let accumulatedTime = 0
    for (let i = 0; i < scenes.length; i++) {
      const sceneDuration = scenes[i].duration
      if (currentTime < accumulatedTime + sceneDuration) {
        return {
          currentScene: scenes[i],
          sceneTime: currentTime - accumulatedTime,
        }
      }
      accumulatedTime += sceneDuration
    }
    return { currentScene: scenes[scenes.length - 1] || null, sceneTime: 0 }
  }, [scenes, currentTime])

  const aspectRatioClass =
    {
      "16:9": "aspect-video",
      "9:16": "aspect-[9/16]",
      "1:1": "aspect-square",
      "4:3": "aspect-[4/3]",
    }[aspectRatio] || "aspect-video"

  if (!currentScene) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d0d12]">
        <p className="text-muted-foreground">No scenes to preview</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-[#0d0d12] overflow-hidden">
      <div
        ref={ref}
        className={cn(
          "relative w-full max-w-4xl rounded-lg overflow-hidden shadow-2xl transition-transform",
          aspectRatioClass,
        )}
        style={{
          background: currentScene.background || "#1a1a24",
          transform: `scale(${zoom / 100})`,
          maxHeight: aspectRatio === "9:16" ? "80vh" : undefined,
          width: aspectRatio === "9:16" ? "auto" : undefined,
        }}
      >
        <CameraWrapper camera={currentScene.camera}>
          <AnimatePresence mode="wait">
            <SceneContent key={currentScene.id} scene={currentScene} sceneTime={sceneTime} />
          </AnimatePresence>
        </CameraWrapper>

        {/* Overlays */}
        {currentScene.particles && (
          <ParticleEffect type={currentScene.particles.type} intensity={currentScene.particles.intensity} />
        )}
        {currentScene.callout && <CalloutOverlay callout={currentScene.callout} />}
        {currentScene.presenter && <PresenterOverlay presenter={currentScene.presenter} />}
        {currentScene.emoji && !["text", "code", "terminal"].includes(currentScene.type) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <EmojiScene scene={currentScene} />
          </div>
        )}
      </div>
    </div>
  )
})
