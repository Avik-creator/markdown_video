// Terminal block parsing

import type { TerminalCommand, VideoVariables } from "../../types.js"
import { substituteVariables } from "../utils.js"

export function parseTerminalBlock(
  lines: string[],
  startIndex: number,
  variables: VideoVariables = {}
): { commands: TerminalCommand[]; endIndex: number } {
  const commands: TerminalCommand[] = []
  let i = startIndex
  let currentPrompt: string | null = null
  let currentCommand = ""
  let outputLines: string[] = []

  const flushCommand = () => {
    if (currentPrompt === null) return

    commands.push({
      prompt: currentPrompt,
      command: currentCommand,
      output: outputLines.join("\n") || undefined,
    })
    currentPrompt = null
    currentCommand = ""
    outputLines = []
  }

  while (i < lines.length) {
    const rawLine = lines[i]
    const line = substituteVariables(rawLine.trim(), variables)

    if (line.startsWith("!") || line === "---" || line.startsWith("```")) {
      break
    }

    if (line.startsWith("$")) {
      flushCommand()
      currentPrompt = "$"
      currentCommand = line.substring(1).trim()
      i++
      continue
    }

    if (line.startsWith(">")) {
      // In the documented terminal syntax, '>' lines following a '$' command
      // are output. A '>' is a command prompt only when the block itself is
      // using '>' as its prompt (or when no command has started yet).
      if (currentPrompt === "$") {
        if (rawLine.trim()) {
          outputLines.push(substituteVariables(rawLine, variables))
        }
      } else {
        flushCommand()
        currentPrompt = ">"
        currentCommand = line.substring(1).trim()
      }
      i++
      continue
    }

    if (currentPrompt !== null && rawLine.trim()) {
      outputLines.push(substituteVariables(rawLine, variables))
    }
    i++
  }

  flushCommand()
  return { commands, endIndex: i }
}
