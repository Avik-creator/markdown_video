// Chart data parsing

import type { ChartDataItem, VideoVariables } from "../../types.js"
import {
  substituteVariables,
  type VariableExpansionBudget,
} from "../utils.js"

const CHART_VALUE_PATTERN = /^(.+?):\s*(-?(?:\d+(?:\.\d+)?|\.\d+))(?:\s+(.+))?$/

export function parseChartData(
  lines: string[],
  startIndex: number,
  variables: VideoVariables = {},
  expansionBudget?: VariableExpansionBudget
): { data: ChartDataItem[]; endIndex: number } {
  const data: ChartDataItem[] = []
  let i = startIndex

  while (i < lines.length) {
    const line = substituteVariables(lines[i].trim(), variables, expansionBudget)

    if (line.startsWith("!") || line === "---") {
      break
    }

    const match = line.match(CHART_VALUE_PATTERN)
    if (match) {
      data.push({
        label: match[1].trim(),
        value: Number.parseFloat(match[2]),
        color: match[3]?.trim(),
      })
    }
    i++
  }

  return { data, endIndex: i }
}
