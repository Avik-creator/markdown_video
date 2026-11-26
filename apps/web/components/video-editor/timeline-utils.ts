// Pure helpers for the timeline: time/position conversion, ruler markers,
// click-vs-drag discrimination and scene reordering in markdown source.
// Kept free of React/DOM dependencies so they can be unit-tested in isolation.

import { SCENE_DIRECTIVES } from "@/lib/parser/constants";
import type { SourceRange } from "@/lib/types";

/**
 * Convert a horizontal pixel offset within a timeline element to a time in
 * seconds. The result is clamped to [0, totalDuration]. Returns 0 when the
 * element has no width or the timeline has no duration.
 */
export function timeAtPosition(
  offsetX: number,
  width: number,
  totalDuration: number,
): number {
  if (width <= 0 || totalDuration <= 0) return 0;
  const ratio = offsetX / width;
  const clamped = Math.min(Math.max(ratio, 0), 1);
  return clamped * totalDuration;
}

/**
 * Inverse of timeAtPosition: percentage (0-100) of the way through the
 * timeline for a given time. Clamped to [0, 100]; 0 for empty timelines.
 */
export function positionPercentForTime(
  time: number,
  totalDuration: number,
): number {
  if (totalDuration <= 0) return 0;
  const percent = (time / totalDuration) * 100;
  return Math.min(Math.max(percent, 0), 100);
}

/** Label step in seconds for the ruler, based on total timeline length. */
export function timeMarkerStep(totalDuration: number): number {
  if (totalDuration > 60) return 10;
  if (totalDuration > 30) return 5;
  if (totalDuration > 15) return 3;
  return 1;
}

/** Times (in seconds) at which ruler labels should be drawn. */
export function buildTimeMarkers(totalDuration: number): number[] {
  const markers: number[] = [];
  if (totalDuration <= 0) return markers;
  const step = timeMarkerStep(totalDuration);
  for (let t = 0; t <= totalDuration; t += step) {
    markers.push(t);
  }
  return markers;
}

/**
 * Whether a pointer movement of (dx, dy) pixels should be treated as a drag
 * rather than a click. Matches framer-motion's pan threshold of 3px by default.
 */
export function exceedsDragThreshold(
  dx: number,
  dy: number,
  threshold = 3,
): boolean {
  return Math.sqrt(dx * dx + dy * dy) >= threshold;
}

/**
 * Build the permutation that maps positions in `reorderedIds` back to indexes
 * in `originalIds`: result[p] is the original index of the item now at
 * position p. Returns null when `reorderedIds` is not an exact permutation of
 * `originalIds`.
 */
export function indexPermutation(
  originalIds: string[],
  reorderedIds: string[],
): number[] | null {
  if (originalIds.length !== reorderedIds.length) return null;
  if (new Set(originalIds).size !== originalIds.length) return null;

  const indexById = new Map(originalIds.map((id, i) => [id, i] as const));
  const result: number[] = [];
  for (const id of reorderedIds) {
    const index = indexById.get(id);
    if (index === undefined) return null;
    result.push(index);
  }
  if (new Set(result).size !== result.length) return null;
  return result;
}

export type AdjacentReorderDirection = "left" | "right";

export interface AdjacentReorderResult {
  /** Permutation in the same order[p] = original-index-at-position-p form used by reorderScenesInMarkdown. */
  order: number[];
  /** Position the moved item occupies after the reorder. */
  targetIndex: number;
}

/**
 * Permutation for moving the item at `index` one position left or right.
 * Returns null when the move would cross either timeline boundary or the
 * inputs are not valid integer indexes.
 */
export function adjacentReorder(
  length: number,
  index: number,
  direction: AdjacentReorderDirection,
): AdjacentReorderResult | null {
  if (!Number.isInteger(length) || length <= 0) return null;
  if (!Number.isInteger(index) || index < 0 || index >= length) return null;

  const targetIndex = direction === "left" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= length) return null;

  const order = Array.from({ length }, (_, i) => i);
  order[index] = targetIndex;
  order[targetIndex] = index;
  return { order, targetIndex };
}

function isValidPermutation(order: number[], length: number): boolean {
  if (order.length !== length) return false;
  const seen = new Set<number>();
  for (const value of order) {
    if (!Number.isInteger(value) || value < 0 || value >= length) return false;
    if (seen.has(value)) return false;
    seen.add(value);
  }
  return true;
}

function startsWithSceneDirective(line: string): boolean {
  const trimmed = line.trim();
  return SCENE_DIRECTIVES.some((dir) => trimmed.startsWith(`!${dir}`));
}

/**
 * Rewrite `markdown` so its scenes appear in a new order, preserving all
 * content byte-for-byte apart from the permutation itself.
 *
 * `sceneRanges` must be the 1-indexed inclusive line ranges of the scenes in
 * document order (as produced by the parser's `sourceMap.scene`), and
 * `order[p]` the original scene index that should end up at position p.
 *
 * The text before the first scene (preamble), the "glue" between scenes
 * (separators, blank lines, comments) and anything after the last scene stay
 * anchored at their original positions; only the scene blocks themselves move.
 *
 * Returns null — meaning "do not rewrite" — when the ranges look inconsistent
 * with the document, so callers can safely bail out instead of corrupting the
 * user's markdown.
 */
export function reorderScenesInMarkdown(
  markdown: string,
  sceneRanges: SourceRange[],
  order: number[],
): string | null {
  const count = sceneRanges.length;
  if (count === 0) return null;
  if (!isValidPermutation(order, count)) return null;

  // Splitting on "\n" and re-joining with "\n" is exactly invertible, so LF
  // documents round-trip byte-for-byte and CRLF content is carried verbatim.
  const lines = markdown.split("\n");

  // Validate ranges: integer, in bounds, ordered and non-overlapping.
  for (let i = 0; i < count; i++) {
    const range = sceneRanges[i];
    if (!Number.isInteger(range.startLine) || !Number.isInteger(range.endLine)) {
      return null;
    }
    if (range.startLine < 1 || range.startLine > range.endLine) return null;
    if (range.endLine > lines.length) return null;
    if (i > 0 && range.startLine <= sceneRanges[i - 1].endLine) return null;
  }

  // Safety net: every range must begin on a scene directive line. If the
  // ranges ever fall out of sync with the document (parser changes, stale
  // state), bail out rather than corrupt the markdown.
  for (const range of sceneRanges) {
    if (!startsWithSceneDirective(lines[range.startLine - 1])) return null;
  }

  const preamble = lines.slice(0, sceneRanges[0].startLine - 1);
  const cores = sceneRanges.map((range) =>
    lines.slice(range.startLine - 1, range.endLine),
  );
  const glues: string[][] = [];
  for (let i = 0; i < count - 1; i++) {
    glues.push(lines.slice(sceneRanges[i].endLine, sceneRanges[i + 1].startLine - 1));
  }
  const trailing = lines.slice(sceneRanges[count - 1].endLine);

  const out: string[] = [...preamble];
  for (let position = 0; position < count; position++) {
    out.push(...cores[order[position]]);
    if (position < count - 1) {
      out.push(...glues[position]);
    }
  }
  out.push(...trailing);

  return out.join("\n");
}
