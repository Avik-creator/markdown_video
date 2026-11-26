import { describe, expect, it } from "vitest";
import {
  hasPlainShortcutModifier,
  matchesCtrlOrMetaShortcut,
  matchesKey,
  normalizeKey,
  playbackSpeedIndex,
  shouldUsePlainShortcut,
  stepFrameTime,
} from "../keyboard";

function keyEvent(
  key: string,
  modifiers: Partial<{
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  }> = {}
) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  };
}

describe("normalizeKey", () => {
  it("normalizes single letter keys case-insensitively", () => {
    expect(normalizeKey("Z")).toBe("z");
    expect(normalizeKey("t")).toBe("t");
  });

  it("leaves named keys unchanged", () => {
    expect(normalizeKey("ArrowLeft")).toBe("ArrowLeft");
    expect(normalizeKey("Escape")).toBe("Escape");
  });
});

describe("matchesCtrlOrMetaShortcut", () => {
  it("matches Ctrl+Z for undo", () => {
    expect(
      matchesCtrlOrMetaShortcut(keyEvent("z", { ctrlKey: true }), "z")
    ).toBe(true);
  });

  it("matches Cmd+Shift+Z for redo even when the key is uppercase", () => {
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("Z", { metaKey: true, shiftKey: true }),
        "z",
        { shiftKey: true }
      )
    ).toBe(true);
  });

  it("does not match when the shift state differs", () => {
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("Z", { ctrlKey: true, shiftKey: true }),
        "z"
      )
    ).toBe(false);
  });

  it("does not match when Alt is also pressed", () => {
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("z", { ctrlKey: true, altKey: true }),
        "z"
      )
    ).toBe(false);
  });
});

describe("non-Latin keyboard layouts", () => {
  it("matches Ctrl+Z when a Cyrillic layout reports key 'я' at physical KeyZ", () => {
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("я", { code: "KeyZ", ctrlKey: true }),
        "z"
      )
    ).toBe(true);
  });

  it("matches Ctrl+Z when a Greek layout reports key 'ζ' at physical KeyZ", () => {
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("ζ", { code: "KeyZ", ctrlKey: true }),
        "z"
      )
    ).toBe(true);
  });

  it("matches Cmd+Z when a Hebrew layout reports key 'ז' at physical KeyZ", () => {
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("ז", { code: "KeyZ", metaKey: true }),
        "z"
      )
    ).toBe(true);
  });

  it("keeps undo and redo distinct on non-Latin layouts via exact shift matching", () => {
    const shifted = keyEvent("Я", { code: "KeyZ", ctrlKey: true, shiftKey: true });
    expect(matchesCtrlOrMetaShortcut(shifted, "z")).toBe(false);
    expect(matchesCtrlOrMetaShortcut(shifted, "z", { shiftKey: true })).toBe(true);

    const unshifted = keyEvent("я", { code: "KeyZ", ctrlKey: true });
    expect(matchesCtrlOrMetaShortcut(unshifted, "z")).toBe(true);
    expect(matchesCtrlOrMetaShortcut(unshifted, "z", { shiftKey: true })).toBe(false);
  });

  it("still excludes AltGr combinations on non-Latin layouts", () => {
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("я", { code: "KeyZ", ctrlKey: true, altKey: true }),
        "z"
      )
    ).toBe(false);
  });

  it("does not hijack rearranged Latin letters such as QWERTZ Y at physical KeyZ", () => {
    // German QWERTZ swaps Z and Y: the key a German user knows as Y sits at
    // the physical KeyZ position and reports the Latin key "y". Because the
    // reported key is a Latin letter, key-based matching keeps governing and
    // the physical-position fallback must not fire.
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("y", { code: "KeyZ", ctrlKey: true }),
        "z"
      )
    ).toBe(false);
    // ...while the key actually labeled Z on that layout (physical KeyY)
    // still matches through its key value, exactly as before.
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("z", { code: "KeyY", ctrlKey: true }),
        "z"
      )
    ).toBe(true);
  });

  it("does not match when the physical key position is different", () => {
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("я", { code: "KeyX", ctrlKey: true }),
        "z"
      )
    ).toBe(false);
  });

  it("does not match a non-Latin key when the event carries no code", () => {
    expect(
      matchesCtrlOrMetaShortcut(keyEvent("я", { ctrlKey: true }), "z")
    ).toBe(false);
  });

  it("keeps US-layout behavior unchanged", () => {
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("z", { code: "KeyZ", ctrlKey: true }),
        "z"
      )
    ).toBe(true);
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("y", { code: "KeyY", ctrlKey: true }),
        "z"
      )
    ).toBe(false);
  });

  it("matches the other letter shortcuts on non-Latin layouts too", () => {
    // Cyrillic 'эс' layout positions: physical KeyF reports 'а', KeyS reports
    // 'ы' — the letters differ, only the physical position is stable.
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("а", { code: "KeyF", ctrlKey: true }),
        "f"
      )
    ).toBe(true);
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("ы", { code: "KeyS", metaKey: true }),
        "s"
      )
    ).toBe(true);
  });

  it("never applies the code fallback to non-letter shortcuts", () => {
    expect(matchesKey(keyEvent("я", { code: "Digit1" }), "1")).toBe(false);
    expect(matchesKey(keyEvent("ж", { code: "Semicolon" }), ";")).toBe(false);
    expect(matchesKey(keyEvent("х", { code: "BracketLeft" }), "[")).toBe(false);
    // Named keys are equally unaffected.
    expect(matchesKey(keyEvent("я", { code: "ArrowLeft" }), "ArrowLeft")).toBe(false);
  });

  it("matches letters case-insensitively regardless of shift state", () => {
    // Shift+Z on a Cyrillic layout reports uppercase 'Я'; the fallback must
    // not care about the casing of the reported key.
    expect(matchesKey(keyEvent("Я", { code: "KeyZ" }), "z")).toBe(true);
    expect(matchesKey(keyEvent("я", { code: "KeyZ" }), "z")).toBe(true);
  });
});

describe("plain shortcut guards", () => {
  it("treats Ctrl, Cmd and Alt as modifiers that disable plain-key shortcuts", () => {
    expect(hasPlainShortcutModifier(keyEvent("-", { ctrlKey: true }))).toBe(true);
    expect(hasPlainShortcutModifier(keyEvent("[", { metaKey: true }))).toBe(true);
    expect(hasPlainShortcutModifier(keyEvent("ArrowLeft", { altKey: true }))).toBe(true);
    expect(hasPlainShortcutModifier(keyEvent("T", { shiftKey: true }))).toBe(false);
  });

  it("allows navigation and letter shortcuts when a button is focused", () => {
    const button = { tagName: "BUTTON" };
    expect(shouldUsePlainShortcut(button, "ArrowLeft")).toBe(true);
    expect(shouldUsePlainShortcut(button, "m")).toBe(true);
    expect(shouldUsePlainShortcut(button, "t")).toBe(true);
    expect(shouldUsePlainShortcut(button, "?")).toBe(true);
  });

  it("does not take over Space from a focused button", () => {
    expect(shouldUsePlainShortcut({ tagName: "BUTTON" }, " ")).toBe(false);
  });

  it("does not handle plain shortcuts while editing text", () => {
    expect(shouldUsePlainShortcut({ tagName: "TEXTAREA" }, "ArrowLeft")).toBe(false);
    expect(shouldUsePlainShortcut({ tagName: "INPUT", type: "text" }, "m")).toBe(false);
    expect(shouldUsePlainShortcut({ tagName: "DIV", isContentEditable: true }, "t")).toBe(false);
  });

  it("does not handle keys that operate select and range controls", () => {
    expect(shouldUsePlainShortcut({ tagName: "SELECT" }, "ArrowDown")).toBe(false);
    expect(shouldUsePlainShortcut({ tagName: "INPUT", type: "range" }, "ArrowLeft")).toBe(false);
    expect(shouldUsePlainShortcut({ tagName: "INPUT", type: "range" }, "Home")).toBe(false);
    expect(shouldUsePlainShortcut({ tagName: "INPUT", type: "range" }, "m")).toBe(true);
  });

  it("leaves arrows and typeahead to composite widgets such as menu items", () => {
    const menuItem = { tagName: "DIV", role: "menuitem" };
    expect(shouldUsePlainShortcut(menuItem, "ArrowDown")).toBe(false);
    expect(shouldUsePlainShortcut(menuItem, "m")).toBe(false);
    expect(shouldUsePlainShortcut({ tagName: "DIV", role: "option" }, "?")).toBe(false);
  });
});

describe("playbackSpeedIndex", () => {
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  it("keeps a valid first index instead of treating it as a fallback", () => {
    expect(playbackSpeedIndex(speeds, 0.5)).toBe(0);
  });

  it("falls back to 1x only when the current speed is absent", () => {
    expect(playbackSpeedIndex(speeds, 3)).toBe(2);
  });
});

describe("stepFrameTime", () => {
  it("steps by one output frame instead of one second", () => {
    expect(stepFrameTime(1, "next", 10, 30)).toBeCloseTo(1 + 1 / 30);
    expect(stepFrameTime(1, "previous", 10, 30)).toBeCloseTo(1 - 1 / 30);
    expect(stepFrameTime(1, "next", 10, 60)).toBeCloseTo(1 + 1 / 60);
  });

  it("clamps to the video bounds", () => {
    expect(stepFrameTime(0, "previous", 10, 30)).toBe(0);
    expect(stepFrameTime(10, "next", 10, 30)).toBe(10);
  });

  it("uses a safe default for an invalid frame rate", () => {
    expect(stepFrameTime(1, "next", 10, 0)).toBeCloseTo(1 + 1 / 30);
  });
});
