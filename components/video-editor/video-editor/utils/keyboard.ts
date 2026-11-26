export interface ShortcutEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export interface ShortcutTargetLike {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
  role?: string;
}

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const DEFAULT_FRAME_RATE = 30;

const BUTTON_INPUT_TYPES = new Set([
  "button",
  "submit",
  "reset",
  "image",
  "file",
]);
const TOGGLE_INPUT_TYPES = new Set(["checkbox", "radio"]);
const NAVIGATION_CONTROL_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
const COMPOSITE_WIDGET_ROLES = new Set([
  "combobox",
  "gridcell",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "row",
  "slider",
  "spinbutton",
  "tab",
  "treeitem",
]);

/** Lowercase printable keys while leaving named keys such as ArrowLeft intact. */
export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function matchesKey(event: ShortcutEventLike, key: string): boolean {
  return normalizeKey(event.key) === normalizeKey(key);
}

/**
 * Match an application shortcut that explicitly uses Ctrl or Cmd.
 *
 * Shift must match exactly: Ctrl+Z is undo, Ctrl+Shift+Z is redo, and
 * Ctrl+Shift+F must not accidentally trigger a Ctrl+F binding. Alt always
 * disqualifies the shortcut because Ctrl+Alt combinations often belong to the
 * OS or use AltGr keyboard input.
 */
export function matchesCtrlOrMetaShortcut(
  event: ShortcutEventLike,
  key: string,
  options: { shiftKey?: boolean } = {}
): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    event.shiftKey === Boolean(options.shiftKey) &&
    matchesKey(event, key)
  );
}

/** Plain-key shortcuts must yield to browser/platform shortcuts with modifiers. */
export function hasPlainShortcutModifier(event: ShortcutEventLike): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}

/**
 * Decide whether a plain-key app shortcut may run for the focused target.
 *
 * Text-entry controls keep all plain keys. Buttons only keep Space (their
 * activation key), so arrows, M, T and ? continue to work after a button is
 * clicked. Selects and text-like inputs keep their native keyboard behavior.
 */
export function shouldUsePlainShortcut(
  target: ShortcutTargetLike | null,
  key: string
): boolean {
  if (!target) return true;

  const normalizedKey = normalizeKey(key);
  const tagName = target.tagName?.toLowerCase();
  const role = target.role?.split(/\s+/)[0]?.toLowerCase();

  if (target.isContentEditable || tagName === "textarea" || tagName === "select") {
    return false;
  }

  if (role && COMPOSITE_WIDGET_ROLES.has(role)) {
    return false;
  }

  if (role === "button") {
    return normalizedKey !== " ";
  }

  if (tagName === "input") {
    const type = (target.type || "text").toLowerCase();

    if (type === "range") {
      return !NAVIGATION_CONTROL_KEYS.has(normalizedKey);
    }

    if (TOGGLE_INPUT_TYPES.has(type)) {
      return normalizedKey !== " " && !NAVIGATION_CONTROL_KEYS.has(normalizedKey);
    }

    if (BUTTON_INPUT_TYPES.has(type)) {
      return normalizedKey !== " ";
    }

    // Text, number, date, color and unknown input types all own printable
    // keys and/or caret-navigation keys. Unknown types are treated as text,
    // matching the browser's input type fallback.
    return false;
  }

  if (tagName === "button") {
    return normalizedKey !== " ";
  }

  return true;
}

/** Extract the small, testable target shape needed by shouldUsePlainShortcut. */
export function getShortcutTarget(target: EventTarget | null): ShortcutTargetLike | null {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return null;
  }

  const role = target.closest("[role]")?.getAttribute("role") ?? undefined;
  const control = target.closest("button, input, select, textarea");
  if (control) {
    return {
      tagName: control.tagName,
      type: control instanceof HTMLInputElement ? control.type : undefined,
      role,
    };
  }

  const editable = target.closest("[contenteditable]");
  return {
    tagName: target.tagName,
    role,
    isContentEditable:
      editable !== null ||
      (target instanceof HTMLElement && target.isContentEditable),
  };
}

/**
 * Index of the current speed, falling back to 1x only when the speed is not
 * in the list. (`findIndex(...) || fallback` is wrong because both 0 and -1
 * need different treatment.)
 */
export function playbackSpeedIndex(
  speeds: readonly number[],
  currentSpeed: number,
  fallbackSpeed = 1
): number {
  const index = speeds.findIndex(
    (speed) => Math.abs(speed - currentSpeed) < 0.01
  );
  if (index !== -1) return index;

  const fallbackIndex = speeds.indexOf(fallbackSpeed);
  return fallbackIndex === -1 ? 0 : fallbackIndex;
}

/** Clamp a one-frame seek to the video bounds. */
export function stepFrameTime(
  currentTime: number,
  direction: "next" | "previous",
  totalDuration: number,
  frameRate = DEFAULT_FRAME_RATE
): number {
  const safeFrameRate =
    Number.isFinite(frameRate) && frameRate > 0 ? frameRate : DEFAULT_FRAME_RATE;
  const frameDuration = 1 / safeFrameRate;
  const delta = direction === "next" ? frameDuration : -frameDuration;
  const duration = Math.max(0, totalDuration);

  return Math.min(Math.max(currentTime + delta, 0), duration);
}
