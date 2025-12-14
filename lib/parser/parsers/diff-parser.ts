// Diff block parsing

import type { DiffLine } from "../../types"

export function parseDiffBlock(lines: string[], startIndex: number): { changes: DiffLine[]; endIndex: number } {
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
