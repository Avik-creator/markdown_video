// Parser utility functions

import { KEYWORD_ALIASES, SCENE_DIRECTIVES } from "./constants"
import type { VideoVariables } from "../types"

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

// Normalize directive name - converts aliases to canonical names
export function normalizeDirective(directive: string): string {
  const lower = directive.toLowerCase()
  return KEYWORD_ALIASES[lower] || lower
}

export interface ParsedDirective {
  /** The exact directive word, lower-cased and including any hyphens. */
  name: string
  /** The directive name after applying KEYWORD_ALIASES. */
  canonicalName: string
  /** Everything after the directive word on the same line. */
  args: string
}

const DIRECTIVE_NAME_PATTERN = /^!(\w[\w-]*)/

/**
 * Parse a complete directive word without prefix matching.
 *
 * In particular, "!section-title" is the directive "section-title" (a
 * chapter alias), not the scene alias "section" followed by extra text.
 */
export function parseDirective(line: string): ParsedDirective | null {
  const match = line.match(DIRECTIVE_NAME_PATTERN)
  if (!match) return null

  const name = match[1].toLowerCase()
  return {
    name,
    canonicalName: normalizeDirective(name),
    args: line.slice(match[0].length).trim(),
  }
}

export function isSceneDirective(line: string): boolean {
  const directive = parseDirective(line)
  if (!directive) return false

  return (
    (SCENE_DIRECTIVES as readonly string[]).includes(directive.name) ||
    directive.canonicalName === "scene"
  )
}

export function parseKeyValue(
  line: string,
  validKeys?: readonly string[]
): { key: string; value: string } | null {
  const match = line.match(/^(\w+):\s*(.+)$/)
  if (!match) return null

  const key = match[1].toLowerCase()
  if (validKeys && !validKeys.includes(key)) return null

  return { key, value: match[2].trim() }
}

export function substituteVariables(text: string, variables: VideoVariables): string {
  return text.replace(/\$(\w+)/g, (match, varName) => {
    return variables[varName] || match
  })
}
