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
  /**
   * Effective inline arguments after the directive word. When the directive
   * word is immediately followed by a colon (`!zoom:1.3`), the directive word
   * is injected into the first token (`zoom:1.3`) to preserve the dialect's
   * historical whole-line-scan shorthand semantics.
   */
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
  const rawArgs = line.slice(match[0].length)

  // Colon-attached shorthand (`!zoom:1.3`, `!split:vertical`,
  // `!device:iphone`) historically behaved as if the whole line were scanned,
  // so the first token was `zoom:1.3`, `split:vertical`, or `device:iphone`.
  // Reconstruct that token here rather than special-casing individual parser
  // branches; a whitespace-separated colon (`!zoom :1.3`) does not opt in.
  const effectiveArgs = rawArgs.startsWith(":") ? `${name}${rawArgs}` : rawArgs

  return {
    name,
    canonicalName: normalizeDirective(name),
    args: effectiveArgs.trim(),
  }
}

/**
 * Collect `!var name value` definitions using the parser's source semantics.
 * Definitions are hoisted by a first pass over the whole document, so a use
 * before its definition still resolves; when a name is repeated, the last
 * definition in document order wins. Values are stored raw and are not
 * recursively expanded.
 */
export function collectVariableDefinitions(
  lines: readonly string[],
  inheritedVariables: VideoVariables = {}
): VideoVariables {
  const variables: VideoVariables = { ...inheritedVariables }

  for (const line of lines) {
    const directive = parseDirective(line.trim())
    if (directive?.canonicalName !== "var") continue

    const match = directive.args.match(/^(\w+)\s+(.+)$/)
    if (match) {
      variables[match[1]] = match[2].trim()
    }
  }

  return variables
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
