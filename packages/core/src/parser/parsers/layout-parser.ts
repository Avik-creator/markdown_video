// Split-layout child content parsing

import type { Scene, VideoVariables } from "../../types.js"
import {
  DELIMITERS,
  DIRECTIVE_CASES,
  SPECIAL_VALUES,
} from "../constants.js"
import {
  isSceneDirective,
  parseDirective,
  substituteVariables,
  type VariableExpansionBudget,
} from "../utils.js"

export type SplitPanel = Omit<Scene, "id" | "duration" | "transition">
export type LayoutSide = "left" | "right"

interface LayoutChunk {
  side: LayoutSide
  lines: string[]
  implicitText: boolean
}

export interface LayoutChildren {
  left: SplitPanel
  right: SplitPanel
  endIndex: number
}

export type ParseLayoutChildScene = (
  markdown: string,
  variables: VideoVariables
) => Scene | undefined

const LAYOUT_CONTENT_DIRECTIVES = new Set<string>([
  DIRECTIVE_CASES.TEXT,
  DIRECTIVE_CASES.CODE,
  DIRECTIVE_CASES.TERMINAL,
  DIRECTIVE_CASES.DIFF,
  DIRECTIVE_CASES.CHART,
  DIRECTIVE_CASES.MOCKUP,
  DIRECTIVE_CASES.IMAGE,
  DIRECTIVE_CASES.EMOJI,
  DIRECTIVE_CASES.QR,
  DIRECTIVE_CASES.COUNTDOWN,
  DIRECTIVE_CASES.PROGRESS,
])

function createDefaultSplitPanel(): SplitPanel {
  return {
    type: "text",
    background: SPECIAL_VALUES.DEFAULT_SPLIT_BG,
  }
}

function sceneToSplitPanel(scene: Scene): SplitPanel {
  const {
    id: _id,
    duration: _duration,
    transition: _transition,
    sourceMap: _sourceMap,
    ...panel
  } = scene

  return {
    ...panel,
    background: SPECIAL_VALUES.DEFAULT_SPLIT_BG,
  }
}

/**
 * Consume child content belonging to !layout.
 *
 * Content directives are assigned to panels in order (first left/top, then
 * right/bottom). Explicit `left:` and `right:` labels may be used to direct
 * content instead. Scene-level directives such as !duration and !background
 * are left unconsumed for the surrounding scene parser.
 *
 * Child blocks are parsed through the supplied single-scene parser so layout
 * panels use exactly the same directive semantics as top-level scenes without
 * creating a module-level circular dependency.
 */
export function parseLayoutChildren(
  lines: string[],
  startIndex: number,
  variables: VideoVariables,
  parseChildScene: ParseLayoutChildScene,
  expansionBudget?: VariableExpansionBudget
): LayoutChildren {
  const panels: Record<LayoutSide, SplitPanel> = {
    left: createDefaultSplitPanel(),
    right: createDefaultSplitPanel(),
  }
  const chunks: LayoutChunk[] = []

  let i = startIndex
  let currentChunk: LayoutChunk | null = null
  let explicitSide: LayoutSide | null = null
  let nextOrderedSide: LayoutSide = "left"
  let inFence = false

  const sideForNextChunk = (): LayoutSide => explicitSide ?? nextOrderedSide
  const finishOrderedChunk = () => {
    if (!explicitSide) nextOrderedSide = "right"
  }

  while (i < lines.length) {
    const rawLine = lines[i]
    const line = substituteVariables(rawLine.trim(), variables, expansionBudget)

    if (
      !inFence &&
      (line === DELIMITERS.SCENE_SEPARATOR || isSceneDirective(line))
    ) {
      break
    }

    if (!inFence) {
      const panelMarker = line.toLowerCase()
      if (panelMarker === "left:" || panelMarker === "right:") {
        explicitSide = panelMarker === "left:" ? "left" : "right"
        currentChunk = null
        i++
        continue
      }
    }

    const directive = inFence ? null : parseDirective(line)
    if (directive) {
      if (!LAYOUT_CONTENT_DIRECTIVES.has(directive.canonicalName)) {
        break
      }

      currentChunk = {
        side: sideForNextChunk(),
        lines: [rawLine],
        implicitText: false,
      }
      chunks.push(currentChunk)
      finishOrderedChunk()
      i++
      continue
    }

    if (!line) {
      if (currentChunk) currentChunk.lines.push(rawLine)
      i++
      continue
    }

    if (!currentChunk) {
      currentChunk = {
        side: sideForNextChunk(),
        lines: [],
        implicitText: true,
      }
      chunks.push(currentChunk)
      finishOrderedChunk()
    }

    currentChunk.lines.push(rawLine)
    if (line.startsWith(DELIMITERS.CODE_FENCE)) {
      inFence = !inFence
    }
    i++
  }

  for (const chunk of chunks) {
    const contentLines = chunk.implicitText
      ? ["!text", ...chunk.lines]
      : chunk.lines
    const childMarkdown = ["!scene", ...contentLines].join("\n")
    const childScene = parseChildScene(childMarkdown, variables)
    if (childScene) {
      panels[chunk.side] = sceneToSplitPanel(childScene)
    }
  }

  return { left: panels.left, right: panels.right, endIndex: i }
}
