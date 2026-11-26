import { describe, expect, it } from "vitest";
import {
  hasPlainShortcutModifier,
  matchesCtrlOrMetaShortcut,
  normalizeKey,
  playbackSpeedIndex,
  shouldUsePlainShortcut,
  stepFrameTime,
} from "../keyboard";

function keyEvent(
  key: string,
  modifiers: Partial<{
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
