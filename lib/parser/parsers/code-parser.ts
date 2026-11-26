// Code block parsing utilities

import type { CodeHighlight, CodeAnnotation, VideoVariables } from "../../types"
import { substituteVariables } from "../utils"

export function parseCodeBlock(
  lines: string[],
  startIndex: number,
  variables: VideoVariables = {}
): { code: string; language: string; endIndex: number } {
  // Fence lines are significant even when indented: the editor validator
  // trims lines before recognizing fences, so the parser does the same.
  const firstLine = lines[startIndex].trim()
  const langMatch = firstLine.match(/^```(\w+)?/)
  const language = langMatch?.[1] || "text"

  let endIndex = startIndex + 1
  const codeLines: string[] = []

  while (endIndex < lines.length && !lines[endIndex].trim().startsWith("```")) {
    codeLines.push(substituteVariables(lines[endIndex], variables))
    endIndex++
  }

  return {
    code: codeLines.join("\n"),
    language,
    endIndex: endIndex + 1,
  }
}

function parseHighlightLineNumber(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  return Number.parseInt(value, 10)
}

export function parseHighlights(value: string): CodeHighlight {
  const lines: number[] = []
  const parts = value.split(",")

  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.includes("-")) {
      const [rawStart, rawEnd] = trimmed.split("-")
      const start = parseHighlightLineNumber(rawStart?.trim() || "")
      const end = parseHighlightLineNumber(rawEnd?.trim() || "")
      if (start === null || end === null) continue

      for (let line = start; line <= end; line++) {
        lines.push(line)
      }
    } else {
      const line = parseHighlightLineNumber(trimmed)
      if (line !== null) lines.push(line)
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
