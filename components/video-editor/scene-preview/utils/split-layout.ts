import type { Scene } from "@/lib/types";

export const DEFAULT_SPLIT_RATIO = 0.5;

export type SplitDirection = "horizontal" | "vertical";
export type SplitSide = "left" | "right";
export type SplitPanel = NonNullable<Scene["split"]>["left"];

/**
 * Ratios are fractions of the split container. Invalid legacy data falls back
 * to an even split; finite outliers are clamped so generated grid styles can
 * never contain NaN, Infinity, or negative track sizes.
 */
export function normalizeSplitRatio(ratio: unknown): number {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) {
    return DEFAULT_SPLIT_RATIO;
  }

  return Math.min(1, Math.max(0, ratio));
}

function formatFraction(value: number): string {
  // Avoid noisy floating point tails such as 0.30000000000000004 in inline
  // styles while preserving useful precision.
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return String(rounded === 0 ? 0 : rounded);
}

/**
 * CSS grid tracks for the two panels plus their one-pixel divider.
 * minmax(0, ...) keeps wide panel content from expanding the fixed tracks.
 */
export function splitGridStyle(
  direction: SplitDirection,
  ratio: unknown
): { gridTemplateColumns?: string; gridTemplateRows?: string } {
  const first = normalizeSplitRatio(ratio);
  const second = Math.max(0, 1 - first);
  const tracks = `minmax(0, ${formatFraction(first)}fr) 1px minmax(0, ${formatFraction(second)}fr)`;

  return direction === "vertical"
    ? { gridTemplateRows: tracks }
    : { gridTemplateColumns: tracks };
}

/**
 * Split panels omit scene identity, duration, and transition fields because
 * they are fragments of a parent scene. Rendering components are shared with
 * top-level scenes, though, so materialize a complete scene object here.
 *
 * The parent duration is intentional: time-dependent scenes such as progress
 * bars use it to derive their state. Transitions are stripped because panels
 * do not transition independently — the parent split scene transitions as a
 * single unit.
 */
export function materializeSplitPanel(
  panel: SplitPanel,
  parentScene: Scene,
  side: SplitSide
): Scene {
  const runtimePanel = panel as Partial<Scene>;
  const {
    id: _id,
    duration: _duration,
    transition: _transition,
    transitionDuration: _transitionDuration,
    ...content
  } = runtimePanel;

  return {
    ...content,
    type: content.type || "text",
    id: `${parentScene.id}-split-${side}`,
    duration: parentScene.duration,
  } as Scene;
}
