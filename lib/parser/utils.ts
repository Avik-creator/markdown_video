// Parser utility functions

import { KEYWORD_ALIASES } from "./constants"
import type { VideoVariables } from "../types"

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

// Normalize directive name - converts aliases to canonical names
export function normalizeDirective(directive: string): string {
  const lower = directive.toLowerCase()
  return KEYWORD_ALIASES[lower] || lower
}

export function parseKeyValue(line: string): { key: string; value: string } | null {
  const match = line.match(/^(\w+):\s*(.+)$/)
  if (match) {
    return { key: match[1].toLowerCase(), value: match[2].trim() }
  }
  return null
}

export function substituteVariables(text: string, variables: VideoVariables): string {
  return text.replace(/\$(\w+)/g, (match, varName) => {
    return variables[varName] || match
  })
}
