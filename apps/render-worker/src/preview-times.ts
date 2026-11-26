/**
 * Choose chronologically ordered preview times across the full timeline,
 * including the first and final states. Five frames is the default middle of
 * the MCP contract's three-to-six-frame range: enough coverage for agents to
 * inspect scene progression without making every response needlessly large.
 */
export function selectPreviewTimes(
  totalDuration: number,
  count = 5,
): number[] {
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    throw new Error("totalDuration must be a positive finite number")
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("count must be a positive integer")
  }
  if (count === 1) {
    return [0]
  }

  return Array.from(
    { length: count },
    (_, index) => (index / (count - 1)) * totalDuration,
  )
}

export function normalizePreviewTimes(
  requestedTimes: number[] | undefined,
  totalDuration: number,
  defaultCount = 5,
) {
  const times = requestedTimes
    ? [...requestedTimes].sort((a, b) => a - b)
    : selectPreviewTimes(totalDuration, defaultCount)

  return times.map((time) => Math.min(time, totalDuration))
}
