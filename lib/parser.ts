// Markdown-to-Video Parser
// Parses custom markdown syntax into scene objects

import type {
  Scene,
  TransitionType,
  AnimationType,
  CodeHighlight,
  CodeAnnotation,
  TerminalCommand,
  DiffLine,
  ChartDataItem,
  ParticleType,
  DeviceType,
  CameraEffect,
  PresenterPosition,
  ChartType,
  Chapter,
  VideoVariables,
} from "./types"

const SCENE_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
]

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function parseKeyValue(line: string): { key: string; value: string } | null {
  const match = line.match(/^(\w+):\s*(.+)$/)
  if (match) {
    return { key: match[1].toLowerCase(), value: match[2].trim() }
  }
  return null
}

function parseCodeBlock(lines: string[], startIndex: number): { code: string; language: string; endIndex: number } {
  const firstLine = lines[startIndex]
  const langMatch = firstLine.match(/^```(\w+)?/)
  const language = langMatch?.[1] || "text"

  let endIndex = startIndex + 1
  const codeLines: string[] = []

  while (endIndex < lines.length && !lines[endIndex].startsWith("```")) {
    codeLines.push(lines[endIndex])
    endIndex++
  }

  return {
    code: codeLines.join("\n"),
    language,
    endIndex: endIndex + 1,
  }
}

function parseHighlights(value: string): CodeHighlight {
  const lines: number[] = []
  const parts = value.split(",")

  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map((n) => Number.parseInt(n, 10))
      for (let i = start; i <= end; i++) {
        lines.push(i)
      }
    } else {
      lines.push(Number.parseInt(trimmed, 10))
    }
  }

  return { lines }
}

function parseAnnotations(lines: string[], startIndex: number): { annotations: CodeAnnotation[]; endIndex: number } {
  const annotations: CodeAnnotation[] = []
  let i = startIndex

  while (i < lines.length && lines[i].trim().startsWith("-")) {
    const match = lines[i].match(/-\s*(\d+):\s*(.+)/)
    if (match) {
      annotations.push({
        line: Number.parseInt(match[1], 10),
        text: match[2].trim(),
      })
    }
    i++
  }

  return { annotations, endIndex: i }
}

function parseTerminalBlock(lines: string[], startIndex: number): { commands: TerminalCommand[]; endIndex: number } {
  const commands: TerminalCommand[] = []
  let i = startIndex

  while (i < lines.length) {
    const line = lines[i].trim()

    if (line.startsWith("!") || line === "---" || line.startsWith("```")) {
      break
    }

    if (line.startsWith("$") || line.startsWith(">")) {
      const prompt = line[0]
      const command = line.substring(1).trim()
      const outputLines: string[] = []
      i++

      // Collect output until next command or end
      while (i < lines.length) {
        const outputLine = lines[i]
        if (
          outputLine.trim().startsWith("$") ||
          outputLine.trim().startsWith(">") ||
          outputLine.trim().startsWith("!") ||
          outputLine.trim() === "---"
        ) {
          break
        }
        if (outputLine.trim()) {
          outputLines.push(outputLine)
        }
        i++
      }

      commands.push({
        prompt,
        command,
        output: outputLines.join("\n") || undefined,
      })
    } else {
      i++
    }
  }

  return { commands, endIndex: i }
}

function parseDiffBlock(lines: string[], startIndex: number): { changes: DiffLine[]; endIndex: number } {
  const changes: DiffLine[] = []
  let i = startIndex

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim().startsWith("!") || line.trim() === "---") {
      break
    }

    if (line.startsWith("+")) {
      changes.push({ type: "add", content: line.substring(1) })
    } else if (line.startsWith("-")) {
      changes.push({ type: "remove", content: line.substring(1) })
    } else if (line.trim()) {
      changes.push({ type: "context", content: line })
    }
    i++
  }

  return { changes, endIndex: i }
}

function parseChartData(lines: string[], startIndex: number): { data: ChartDataItem[]; endIndex: number } {
  const data: ChartDataItem[] = []
  let i = startIndex

  while (i < lines.length) {
    const line = lines[i].trim()

    if (line.startsWith("!") || line === "---") {
      break
    }

    const match = line.match(/^(.+?):\s*(\d+)(?:\s+(.+))?$/)
    if (match) {
      data.push({
        label: match[1].trim(),
        value: Number.parseInt(match[2], 10),
        color: match[3]?.trim(),
      })
    }
    i++
  }

  return { data, endIndex: i }
}

function substituteVariables(text: string, variables: VideoVariables): string {
  return text.replace(/\$(\w+)/g, (match, varName) => {
    return variables[varName] || match
  })
}

export interface ParseResult {
  scenes: Scene[]
  chapters: Chapter[]
  variables: VideoVariables
}

export function parseMarkdown(markdown: string): Scene[] {
  const result = parseMarkdownFull(markdown)
  return result.scenes
}

export function parseMarkdownFull(markdown: string): ParseResult {
  const scenes: Scene[] = []
  const chapters: Chapter[] = []
  const variables: VideoVariables = {}
  const lines = markdown.split("\n")
  let i = 0
  let colorIndex = 0
  let currentTime = 0

  // First pass: collect variables
  for (const line of lines) {
    const match = line.match(/^!var\s+(\w+)\s+(.+)$/)
    if (match) {
      variables[match[1]] = match[2].trim()
    }
  }

  while (i < lines.length) {
    let line = lines[i].trim()

    // Variable substitution
    line = substituteVariables(line, variables)

    // Check for scene directive
    if (line.startsWith("!scene")) {
      const scene: Scene = {
        id: generateId(),
        type: "text",
        duration: 3,
        background: SCENE_COLORS[colorIndex % SCENE_COLORS.length],
      }
      colorIndex++
      i++

      // Parse scene properties
      while (i < lines.length) {
        const currentLine = substituteVariables(lines[i].trim(), variables)

        // End of scene or next scene
        if (currentLine.startsWith("!scene") || currentLine === "---") {
          break
        }

        // Parse directives
        if (currentLine.startsWith("!")) {
          const directiveMatch = currentLine.match(/^!(\w+)/)
          const directive = directiveMatch ? directiveMatch[1] : ""

          switch (directive) {
            case "chapter": {
              const match = currentLine.match(/!chapter\s+"([^"]+)"/)
              if (match) {
                scene.chapter = match[1]
                chapters.push({
                  id: generateId(),
                  title: match[1],
                  time: currentTime,
                })
              }
              i++
              break
            }

            case "transition": {
              const match = currentLine.match(/!transition\s+(\w+)(?:\s+(\d+(?:\.\d+)?)s)?/)
              if (match) {
                scene.transition = match[1] as TransitionType
                if (match[2]) {
                  scene.transitionDuration = Number.parseFloat(match[2])
                }
              }
              i++
              break
            }

            case "duration": {
              const match = currentLine.match(/!duration\s+(\d+(?:\.\d+)?)s?/)
              if (match) {
                scene.duration = Number.parseFloat(match[1])
              }
              i++
              break
            }

            case "text": {
              scene.type = "text"
              const textContent: string[] = []
              let animation: AnimationType = "fadeIn"
              let size: "sm" | "md" | "lg" | "xl" | "2xl" = "lg"
              i++

              while (i < lines.length) {
                const textLine = substituteVariables(lines[i].trim(), variables)
                if (textLine.startsWith("!") || textLine === "---") {
                  break
                }

                const kv = parseKeyValue(textLine)
                if (kv) {
                  if (kv.key === "animation") animation = kv.value as AnimationType
                  if (kv.key === "size") size = kv.value as "sm" | "md" | "lg" | "xl" | "2xl"
                } else if (textLine) {
                  textContent.push(textLine)
                }
                i++
              }

              scene.text = {
                content: textContent.join("\n"),
                animation,
                size,
                align: "center",
              }
              break
            }

            case "code": {
              scene.type = "code"
              i++
              let highlights: CodeHighlight | undefined
              let annotations: CodeAnnotation[] = []
              let typing = false
              let typingSpeed = 50

              while (i < lines.length) {
                const codeLine = substituteVariables(lines[i].trim(), variables)

                if (codeLine.startsWith("```")) {
                  const parsed = parseCodeBlock(lines, i)
                  scene.code = {
                    language: parsed.language,
                    content: parsed.code,
                    highlight: highlights,
                    annotations,
                    showLineNumbers: true,
                    typing,
                    typingSpeed,
                  }
                  i = parsed.endIndex
                  break
                } else if (codeLine.startsWith("highlight:")) {
                  highlights = parseHighlights(codeLine.substring(10))
                  i++
                } else if (codeLine.startsWith("annotations:")) {
                  i++
                  const parsed = parseAnnotations(lines, i)
                  annotations = parsed.annotations
                  i = parsed.endIndex
                } else if (codeLine.startsWith("typing:")) {
                  typing = codeLine.substring(7).trim() === "true"
                  i++
                } else if (codeLine.startsWith("speed:")) {
                  typingSpeed = Number.parseInt(codeLine.substring(6).trim(), 10)
                  i++
                } else {
                  i++
                }
              }
              break
            }

            case "terminal": {
              scene.type = "terminal"
              i++
              let typing = true
              let typingSpeed = 30

              while (i < lines.length) {
                const termLine = lines[i].trim()
                if (termLine.startsWith("typing:")) {
                  typing = termLine.substring(7).trim() === "true"
                  i++
                } else if (termLine.startsWith("speed:")) {
                  typingSpeed = Number.parseInt(termLine.substring(6).trim(), 10)
                  i++
                } else if (termLine.startsWith("$") || termLine.startsWith(">")) {
                  const parsed = parseTerminalBlock(lines, i)
                  scene.terminal = {
                    commands: parsed.commands,
                    typing,
                    typingSpeed,
                  }
                  i = parsed.endIndex
                  break
                } else if (termLine.startsWith("!") || termLine === "---") {
                  break
                } else {
                  i++
                }
              }
              break
            }

            case "diff": {
              scene.type = "diff"
              const langMatch = currentLine.match(/!diff\s+(\w+)?/)
              i++

              const parsed = parseDiffBlock(lines, i)
              scene.diff = {
                language: langMatch?.[1] || "text",
                changes: parsed.changes,
              }
              i = parsed.endIndex
              break
            }

            case "chart": {
              scene.type = "chart"
              const typeMatch = currentLine.match(/type:(\w+)/)
              const animateMatch = currentLine.match(/animate:(true|false)/)
              i++

              const parsed = parseChartData(lines, i)
              scene.chart = {
                type: (typeMatch?.[1] || "bar") as ChartType,
                data: parsed.data,
                animate: animateMatch?.[1] !== "false",
              }
              i = parsed.endIndex
              break
            }

            case "mockup": {
              scene.type = "mockup"
              const deviceMatch = currentLine.match(/device:(\w+)/)
              scene.mockup = {
                device: (deviceMatch?.[1] || "browser") as DeviceType,
                content: { type: "text", background: "#ffffff" },
              }
              i++
              break
            }

            case "callout": {
              const arrowMatch = currentLine.match(/arrow:(\w+)/)
              const targetMatch = currentLine.match(/target:(\S+)/)
              const textMatch = currentLine.match(/"([^"]+)"/)

              scene.callout = {
                text: textMatch?.[1] || "",
                arrow: (arrowMatch?.[1] || "down") as "up" | "down" | "left" | "right",
                target: targetMatch?.[1],
                style: "info",
              }
              i++
              break
            }

            case "particles": {
              const typeMatch = currentLine.match(/type:(\w+)/)
              const intensityMatch = currentLine.match(/intensity:(\w+)/)

              scene.particles = {
                type: (typeMatch?.[1] || "confetti") as ParticleType,
                intensity: (intensityMatch?.[1] || "medium") as "low" | "medium" | "high",
              }
              i++
              break
            }

            case "camera": {
              const effectMatch = currentLine.match(/(zoom|pan|shake)/)
              const valueMatch = currentLine.match(/:([\d.]+)/)
              const durationMatch = currentLine.match(/duration:([\d.]+)s?/)

              scene.camera = {
                effect: (effectMatch?.[1] || "zoom") as CameraEffect,
                value: valueMatch ? Number.parseFloat(valueMatch[1]) : 1.5,
                duration: durationMatch ? Number.parseFloat(durationMatch[1]) : 1,
              }
              i++
              break
            }

            case "presenter": {
              const posMatch = currentLine.match(/position:(\S+)/)
              const sizeMatch = currentLine.match(/size:(\w+)/)
              const shapeMatch = currentLine.match(/shape:(\w+)/)

              scene.presenter = {
                position: (posMatch?.[1] || "bottom-right") as PresenterPosition,
                size: (sizeMatch?.[1] || "md") as "sm" | "md" | "lg",
                shape: (shapeMatch?.[1] || "circle") as "circle" | "square" | "rounded",
              }
              i++
              break
            }

            case "layout": {
              scene.type = "split"
              const dirMatch = currentLine.match(/split:(\w+)/)
              scene.split = {
                left: { type: "text", background: "#1e1e2e" },
                right: { type: "text", background: "#1e1e2e" },
                direction: dirMatch?.[1] === "vertical" ? "vertical" : "horizontal",
                ratio: 0.5,
              }
              i++
              break
            }

            case "image": {
              scene.type = "image"
              const srcMatch = currentLine.match(/src:(\S+)/)
              const fitMatch = currentLine.match(/fit:(cover|contain|fill)/)
              const posMatch = currentLine.match(/position:(center|top|bottom|left|right)/)
              const altMatch = currentLine.match(/alt:"([^"]+)"/)

              scene.image = {
                src: srcMatch?.[1] || "",
                fit: (fitMatch?.[1] as "cover" | "contain" | "fill") || "cover",
                position: (posMatch?.[1] as "center" | "top" | "bottom" | "left" | "right") || "center",
                alt: altMatch?.[1],
              }
              i++
              break
            }

            case "emoji": {
              const emojiMatch = currentLine.match(/!emoji\s+(\S+)/)
              const sizeMatch = currentLine.match(/size:(sm|md|lg|xl|2xl)/)
              const animateMatch = currentLine.match(/animate:(bounce|spin|pulse|shake|none)/)

              scene.emoji = {
                emoji: emojiMatch?.[1] || "🎉",
                size: (sizeMatch?.[1] as "sm" | "md" | "lg" | "xl" | "2xl") || "xl",
                animate: (animateMatch?.[1] as "bounce" | "spin" | "pulse" | "shake" | "none") || "none",
              }
              i++
              break
            }

            case "qr": {
              scene.type = "qr"
              const urlMatch = currentLine.match(/url:(\S+)/)
              const sizeMatch = currentLine.match(/size:(\d+)/)
              const colorMatch = currentLine.match(/color:(\S+)/)
              const bgMatch = currentLine.match(/bg:(\S+)/)
              const labelMatch = currentLine.match(/label:"([^"]+)"/)

              scene.qr = {
                url: urlMatch?.[1] || "https://example.com",
                size: sizeMatch ? Number.parseInt(sizeMatch[1], 10) : 200,
                color: colorMatch?.[1] || "#ffffff",
                bgColor: bgMatch?.[1] || "transparent",
                label: labelMatch?.[1],
              }
              i++
              break
            }

            case "countdown": {
              scene.type = "countdown"
              const fromMatch = currentLine.match(/from:(\d+)/)
              const styleMatch = currentLine.match(/style:(digital|circle|minimal)/)
              const colorMatch = currentLine.match(/color:(\S+)/)

              scene.countdown = {
                from: fromMatch ? Number.parseInt(fromMatch[1], 10) : 10,
                style: (styleMatch?.[1] as "digital" | "circle" | "minimal") || "digital",
                color: colorMatch?.[1] || "#ec4899",
              }
              i++
              break
            }

            case "progress": {
              scene.type = "progress"
              const valueMatch = currentLine.match(/value:(\d+)/)
              const maxMatch = currentLine.match(/max:(\d+)/)
              const animateMatch = currentLine.match(/animate:(true|false)/)
              const styleMatch = currentLine.match(/style:(bar|circle|semicircle)/)
              const colorMatch = currentLine.match(/color:(\S+)/)
              const labelMatch = currentLine.match(/label:"([^"]+)"/)

              scene.progress = {
                value: valueMatch ? Number.parseInt(valueMatch[1], 10) : 50,
                max: maxMatch ? Number.parseInt(maxMatch[1], 10) : 100,
                animate: animateMatch?.[1] !== "false",
                style: (styleMatch?.[1] as "bar" | "circle" | "semicircle") || "bar",
                color: colorMatch?.[1] || "#ec4899",
                label: labelMatch?.[1],
              }
              i++
              break
            }

            case "background": {
              const match = currentLine.match(/!background\s+(.+)/)
              if (match) {
                scene.background = substituteVariables(match[1].trim(), variables)
              }
              i++
              break
            }

            case "var": {
              i++
              break
            }

            default:
              i++
          }
        } else {
          i++
        }
      }

      currentTime += scene.duration
      scenes.push(scene)
    } else {
      i++
    }
  }

  return { scenes, chapters, variables }
}

export function getTimelineSegments(scenes: Scene[]): {
  segments: {
    sceneId: string
    startTime: number
    endTime: number
    duration: number
    color: string
    label: string
    chapter?: string
  }[]
  totalDuration: number
} {
  const segments: {
    sceneId: string
    startTime: number
    endTime: number
    duration: number
    color: string
    label: string
    chapter?: string
  }[] = []
  let currentTime = 0

  scenes.forEach((scene, index) => {
    segments.push({
      sceneId: scene.id,
      startTime: currentTime,
      endTime: currentTime + scene.duration,
      duration: scene.duration,
      color: scene.background || SCENE_COLORS[index % SCENE_COLORS.length],
      label: `${scene.duration}s`,
      chapter: scene.chapter,
    })
    currentTime += scene.duration
  })

  return { segments, totalDuration: currentTime }
}

export function getSceneAtTime(
  scenes: Scene[],
  time: number,
): { scene: Scene; index: number; sceneTime: number } | null {
  let currentTime = 0

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    if (time >= currentTime && time < currentTime + scene.duration) {
      return {
        scene,
        index: i,
        sceneTime: time - currentTime,
      }
    }
    currentTime += scene.duration
  }

  if (scenes.length > 0) {
    const lastScene = scenes[scenes.length - 1]
    return {
      scene: lastScene,
      index: scenes.length - 1,
      sceneTime: lastScene.duration,
    }
  }

  return null
}
