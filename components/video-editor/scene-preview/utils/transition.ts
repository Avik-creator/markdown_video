/**
 * Transition timing helpers shared by preview and export rendering.
 *
 * The authoritative directive schema declares 0.5s as the default transition
 * duration and requires explicit durations to be positive. Invalid legacy or
 * hand-authored scene data therefore falls back to that schema default rather
 * than producing Infinity/NaN styles.
 */
export const DEFAULT_TRANSITION_DURATION = 0.5;

export function normalizeTransitionDuration(duration: unknown): number {
  if (
    typeof duration === "number" &&
    Number.isFinite(duration) &&
    duration > 0
  ) {
    return duration;
  }

  return DEFAULT_TRANSITION_DURATION;
}

/**
 * Deterministic linear transition progress in the inclusive range [0, 1].
 */
export function transitionProgress(
  sceneTime: number,
  duration: unknown
): number {
  if (typeof sceneTime !== "number" || Number.isNaN(sceneTime)) {
    return 0;
  }
  if (sceneTime === Infinity) {
    return 1;
  }
  if (sceneTime <= 0) {
    return 0;
  }

  const safeDuration = normalizeTransitionDuration(duration);
  return Math.min(1, sceneTime / safeDuration);
}
