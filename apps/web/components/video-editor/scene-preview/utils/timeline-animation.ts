import type { AnimationType, TimelineElement } from "@/lib/types";

/** Seconds timeline elements spend entering, matching the previous preview. */
export const TIMELINE_ELEMENT_ENTER_DURATION = 0.3;
/** Seconds spent exiting after `at + duration`, matching framer's default. */
export const TIMELINE_ELEMENT_EXIT_DURATION = 0.3;

export interface TimelineVisualState {
  opacity: number;
  x: number;
  y: number;
  scale: number;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value === Infinity) return 1;
  if (value === -Infinity) return 0;
  return Math.min(1, Math.max(0, value));
}

function visibleState(
  animation: AnimationType | undefined,
  progress: number
): TimelineVisualState {
  switch (animation) {
    case "slideUp":
      return { opacity: progress, x: 0, y: 20 * (1 - progress), scale: 1 };
    case "slideDown":
      return { opacity: progress, x: 0, y: -20 * (1 - progress), scale: 1 };
    case "slideLeft":
      return { opacity: progress, x: 20 * (1 - progress), y: 0, scale: 1 };
    case "slideRight":
      return { opacity: progress, x: -20 * (1 - progress), y: 0, scale: 1 };
    case "zoomIn":
    case "bounceIn":
      return {
        opacity: progress,
        x: 0,
        y: 0,
        scale: 0.8 + 0.2 * progress,
      };
    case "none":
      return { opacity: 1, x: 0, y: 0, scale: 1 };
    case "fadeIn":
    case "typewriter":
    default:
      return { opacity: progress, x: 0, y: 0, scale: 1 };
  }
}

function exitState(animation: AnimationType | undefined): TimelineVisualState {
  switch (animation) {
    case "slideUp":
      return { opacity: 0, x: 0, y: -50, scale: 1 };
    case "slideDown":
      return { opacity: 0, x: 0, y: 50, scale: 1 };
    case "slideLeft":
      return { opacity: 0, x: -50, y: 0, scale: 1 };
    case "slideRight":
      return { opacity: 0, x: 50, y: 0, scale: 1 };
    case "zoomIn":
      return { opacity: 0, x: 0, y: 0, scale: 1.2 };
    case "bounceIn":
      return { opacity: 0, x: 0, y: 0, scale: 0.3 };
    case "none":
      return { opacity: 1, x: 0, y: 0, scale: 1 };
    case "fadeIn":
    case "typewriter":
    default:
      return { opacity: 0, x: 0, y: 0, scale: 1 };
  }
}

function interpolateState(
  from: TimelineVisualState,
  to: TimelineVisualState,
  progress: number
): TimelineVisualState {
  return {
    opacity: from.opacity + (to.opacity - from.opacity) * progress,
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    scale: from.scale + (to.scale - from.scale) * progress,
  };
}

/**
 * Complete visual state for an in-scene timeline element at `sceneTime`.
 *
 * The previous implementation started a wall-clock framer-motion exit when
 * the element unmounted. Export capture speed therefore controlled how far
 * that exit had progressed. Instead, the element remains mounted for the same
 * nominal exit duration and both entrance and exit are calculated here as a
 * pure function of scene time.
 */
export function timelineElementVisualState(
  element: TimelineElement,
  sceneTime: number
): TimelineVisualState | null {
  if (
    !Number.isFinite(sceneTime) ||
    !Number.isFinite(element.at) ||
    !Number.isFinite(element.duration) ||
    element.duration <= 0
  ) {
    return null;
  }

  const enterStart = element.at;
  const exitStart = element.at + element.duration;
  const exitEnd = exitStart + TIMELINE_ELEMENT_EXIT_DURATION;

  if (sceneTime < enterStart || sceneTime >= exitEnd) {
    return null;
  }

  const animation = element.animation || "fadeIn";
  const entranceAtExitStart = visibleState(
    animation,
    clamp01(element.duration / TIMELINE_ELEMENT_ENTER_DURATION)
  );

  if (sceneTime < exitStart) {
    const enterProgress = clamp01(
      (sceneTime - enterStart) / TIMELINE_ELEMENT_ENTER_DURATION
    );
    return visibleState(animation, enterProgress);
  }

  const exitProgress = clamp01(
    (sceneTime - exitStart) / TIMELINE_ELEMENT_EXIT_DURATION
  );
  return interpolateState(
    entranceAtExitStart,
    exitState(animation),
    exitProgress
  );
}
