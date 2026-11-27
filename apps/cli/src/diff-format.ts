import type { DiffReport, SceneDiffReportRow } from "./diff-model.js"

function sceneIndex(scene: SceneDiffReportRow["old"]) {
  return scene ? `#${scene.index + 1}` : "—"
}

function percent(value: number) {
  return `${value.toFixed(3)}%`
}

function signedSeconds(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}s`
}

function rowType(row: SceneDiffReportRow) {
  return row.new?.type ?? row.old?.type ?? "unknown"
}

function rowDetail(row: SceneDiffReportRow) {
  const details: string[] = []
  if (row.status === "added" || row.status === "removed") {
    details.push("not compared")
  } else if (row.status === "modified") {
    details.push(`content similarity ${row.contentSimilarity?.toFixed(3) ?? "unknown"}`)
  } else if (row.status === "retimed") {
    const position = row.timing.positionDeltaSeconds ?? 0
    const duration = row.timing.durationDeltaSeconds ?? 0
    const timing: string[] = []
    if (position !== 0) timing.push(`start ${signedSeconds(position)}`)
    if (duration !== 0) timing.push(`duration ${signedSeconds(duration)}`)
    details.push(timing.length > 0 ? timing.join(", ") : "timing changed")
  } else {
    details.push("same source content")
  }

  if (row.unexpectedReasons.length > 0) {
    details.push(`UNEXPECTED: ${row.unexpectedReasons.join("; ")}`)
  }
  return details.join("; ")
}

function formatTable(rows: SceneDiffReportRow[]) {
  const header = ["STATUS", "OLD", "NEW", "TYPE", "CHANGE", "CLASS", "DETAIL"]
  const body = rows.map((row) => [
    row.status,
    sceneIndex(row.old),
    sceneIndex(row.new),
    rowType(row),
    row.comparison ? percent(row.comparison.meanChangePercent) : "—",
    row.comparison?.classification ?? "—",
    rowDetail(row),
  ])
  const widths = header.map((cell, column) =>
    Math.max(cell.length, ...body.map((row) => row[column]!.length)),
  )
  const formatRow = (row: string[]) =>
    row.map((cell, column) => cell.padEnd(widths[column]!)).join("  ").trimEnd()

  return [
    formatRow(header),
    formatRow(widths.map((width) => "-".repeat(width))),
    ...body.map((row) => formatRow(row)),
  ]
}

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`
}

/** Human terminal report. Machine consumers should use --json instead of parsing this text. */
export function formatDiffReport(report: DiffReport) {
  const lines = [
    `markdown-video visual diff: ${report.inputs.old.path} -> ${report.inputs.new.path}`,
    "",
    ...formatTable(report.scenes),
    "",
    `Summary: ${plural(report.summary.alignedPairs, "aligned pair")} (` +
      `${report.summary.unchangedContent} unchanged, ` +
      `${report.summary.modified} modified, ` +
      `${report.summary.retimed} retimed), ` +
      `${report.summary.added} added, ` +
      `${report.summary.removed} removed; ` +
      `${plural(report.summary.unexpectedScenes, "unexpected scene")}`,
  ]

  if (report.verdict === "pass") {
    lines.push("Verdict: PASS — no unexpected visual changes")
  } else {
    lines.push(
      `Verdict: FAIL — ${plural(report.summary.unexpectedScenes, "unexpected scene change")}`,
    )
  }
  lines.push(
    `Unexpected rule: unchanged/retimed scenes at >=${percent(report.settings.unchangedThresholdPercent)}; ` +
      `modified scenes only when similarity >=${report.settings.modifiedOutlierMinContentSimilarity.toFixed(2)} ` +
      `and a frame changes >=${percent(report.settings.modifiedOutlierPercent)}.`,
  )
  lines.push(
    `Cost: ${plural(report.summary.comparedFramePairs, "frame pair")} compared ` +
      `(${plural(report.summary.capturedFrames, "captured frame")}) in ${report.summary.elapsedSeconds.toFixed(2)}s total ` +
      `(old capture ${report.summary.oldRenderElapsedSeconds.toFixed(2)}s, new capture ${report.summary.newRenderElapsedSeconds.toFixed(2)}s); ` +
      `${plural(report.summary.comparisonImagesWritten, "comparison image")} written.`,
  )
  return `${lines.join("\n")}\n`
}
