// Terminal block parsing

import type { TerminalCommand } from "../../types"

export function parseTerminalBlock(lines: string[], startIndex: number): { commands: TerminalCommand[]; endIndex: number } {
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
