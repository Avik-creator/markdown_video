// Code block parsing utilities

import type { CodeHighlight, CodeAnnotation } from "../../types"

export function parseCodeBlock(lines: string[], startIndex: number): { code: string; language: string; endIndex: number } {
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

export function parseHighlights(value: string): CodeHighlight {
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

export function parseAnnotations(lines: string[], startIndex: number): { annotations: CodeAnnotation[]; endIndex: number } {
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
