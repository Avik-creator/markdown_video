export interface ShortcutEventLike {
  key: string;
  /**
   * Physical key position (e.g. "KeyZ"), stable across keyboard layouts.
   * Optional so test doubles and non-DOM callers can omit it; real
   * KeyboardEvents always carry it.
   */
  code?: string;
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

/** True for single lowercase Latin letters a-z. */
function isLatinLetter(key: string): boolean {
  return key.length === 1 && key >= "a" && key <= "z";
}

/**
 * Match an event against a shortcut key, case-insensitively.
 *
 * Non-Latin keyboard layouts (Cyrillic, Greek, Hebrew, ...) report non-Latin
 * `key` values for the letter keys — the physical Z key produces "я", "ζ" or
 * "ז" — so matching `key` alone means Ctrl+Z and the other letter shortcuts
 * never fire there. `event.code` is layout-independent, so as a fallback a
 * single-letter Latin shortcut also matches when the event's `code` is
 * `"Key" + letter`.
 *
 * The fallback only applies when the event's `key` is not itself a Latin
 * letter. On Latin layouts with rearranged letters (QWERTZ, AZERTY, Dvorak)
 * the reported `key` is the layout's own letter, and key-based matching must
 * keep governing — otherwise e.g. the key a QWERTZ user knows as Y (physical
 * KeyZ) would suddenly trigger the undo binding. Non-letter shortcuts never
 * use the fallback: punctuation `code` values are themselves layout-dependent
 * in complex ways.
 */
export function matchesKey(event: ShortcutEventLike, key: string): boolean {
  const normalizedKey = normalizeKey(key);
  if (normalizeKey(event.key) === normalizedKey) return true;

  if (
    isLatinLetter(normalizedKey) &&
    !isLatinLetter(normalizeKey(event.key)) &&
    event.code === `Key${normalizedKey.toUpperCase()}`
  ) {
    return true;
  }

  return false;
}

export type ShortcutPlatform = "mac" | "other";

/**
 * Platform detection for shortcut modifier semantics, injectable for tests.
 *
 * `navigator.platform` ("MacIntel", also reported by iPads in desktop mode)
 * is the primary signal; the user agent covers environments where platform
 * is empty or privacy-reduced. Anything unrecognized is treated as non-mac,
 * which keeps the more permissive modifier behavior.
 */
export function detectShortcutPlatform(
  navigatorLike?: { platform?: string; userAgent?: string }
): ShortcutPlatform {
  const nav =
    navigatorLike ??
    (typeof navigator !== "undefined" ? navigator : undefined);
  if (!nav) return "other";

  if (/^mac/i.test(nav.platform ?? "")) return "mac";
  if (/macintosh|mac os x/i.test(nav.userAgent ?? "")) return "mac";
  return "other";
}

/**
 * Match an application shortcut that explicitly uses Ctrl or Cmd.
 *
 * The modifier rules are platform-dependent:
 *
 * - On macOS only Cmd (metaKey) matches, never bare Ctrl. macOS turns
 *   Ctrl+letter keys into emacs-style text-editing bindings — Ctrl+N next
 *   line, Ctrl+E end of line, Ctrl+F forward character, Ctrl+H delete-back,
 *   Ctrl+O open-line — so hijacking them for application shortcuts (new,
 *   export, find, replace, open) would break text editing in the editor.
 *   Pressing Ctrl and Cmd together is not the shortcut either.
 * - On other platforms Ctrl or Cmd matches, as before: Windows and Linux
 *   have no emacs-binding conflict, and users may press either modifier.
 *
 * Shift must match exactly: Ctrl+Z is undo, Ctrl+Shift+Z is redo, and
 * Ctrl+Shift+F must not accidentally trigger a Ctrl+F binding. Alt always
 * disqualifies the shortcut because Ctrl+Alt combinations often belong to the
 * OS or use AltGr keyboard input.
 */
export function matchesCtrlOrMetaShortcut(
  event: ShortcutEventLike,
  key: string,
  options: { shiftKey?: boolean; platform?: ShortcutPlatform } = {}
): boolean {
  const platform = options.platform ?? detectShortcutPlatform();
  const modifierMatch =
    platform === "mac"
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey || event.metaKey;

  return (
    modifierMatch &&
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
