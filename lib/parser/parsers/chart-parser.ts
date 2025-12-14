// Chart data parsing

import type { ChartDataItem } from "../../types"

export function parseChartData(lines: string[], startIndex: number): { data: ChartDataItem[]; endIndex: number } {
  const data: ChartDataItem[] = []
  let i = startIndex

  while (i < lines.length) {
    const line = lines[i].trim()

    if (line.startsWith("!") || line === "---") {
      break
    }

    const match = line.match(/^(.+?):\s*(\d+)(?:\s+(.+))?$/)
    if (match) {
      data.push({
        label: match[1].trim(),
        value: Number.parseInt(match[2], 10),
        color: match[3]?.trim(),
      })
    }
    i++
  }

  return { data, endIndex: i }
}
