import { describe, expect, it } from "vitest";
import {
  detectShortcutPlatform,
  hasPlainShortcutModifier,
  matchesCtrlOrMetaShortcut,
  matchesKey,
  normalizeKey,
  playbackSpeedIndex,
  shouldUsePlainShortcut,
  stepFrameTime,
  type ShortcutEventLike,
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

/**
 * The key-matching and layout-fallback behavior tests below predate
 * platform-aware modifiers and describe the permissive non-mac rules. Pin
 * the platform explicitly so the suite does not depend on the host machine's
 * own navigator (a macOS dev machine would otherwise flip them).
 */
function matchesOtherPlatform(
  event: ShortcutEventLike,
  key: string,
  options: { shiftKey?: boolean } = {}
) {
  return matchesCtrlOrMetaShortcut(event, key, { ...options, platform: "other" });
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
      matchesOtherPlatform(keyEvent("z", { ctrlKey: true }), "z")
    ).toBe(true);
  });

  it("matches Cmd+Shift+Z for redo even when the key is uppercase", () => {
    expect(
      matchesOtherPlatform(
        keyEvent("Z", { metaKey: true, shiftKey: true }),
        "z",
        { shiftKey: true }
      )
    ).toBe(true);
  });

  it("does not match when the shift state differs", () => {
    expect(
      matchesOtherPlatform(
        keyEvent("Z", { ctrlKey: true, shiftKey: true }),
        "z"
      )
    ).toBe(false);
  });

  it("does not match when Alt is also pressed", () => {
    expect(
      matchesOtherPlatform(
        keyEvent("z", { ctrlKey: true, altKey: true }),
        "z"
      )
    ).toBe(false);
  });
});

describe("platform-dependent modifiers", () => {
  it("on macOS, bare Ctrl+Z does not trigger undo — it is the emacs text-editing layer", () => {
    expect(
      matchesCtrlOrMetaShortcut(keyEvent("z", { ctrlKey: true }), "z", {
        platform: "mac",
      })
    ).toBe(false);
  });

  it("on macOS, Cmd+Z triggers undo", () => {
    expect(
      matchesCtrlOrMetaShortcut(keyEvent("z", { metaKey: true }), "z", {
        platform: "mac",
      })
    ).toBe(true);
  });

  it("on macOS, Ctrl+Cmd together is not the shortcut", () => {
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("z", { ctrlKey: true, metaKey: true }),
        "z",
        { platform: "mac" }
      )
    ).toBe(false);
  });

  it("on macOS, the emacs-conflicting letters stay text-editing keys", () => {
    // Ctrl+N/E/O/H/F are next-line, end-of-line, open-line, delete-back and
    // forward-char on macOS — none of them may fire the new/export/open/
    // replace/find application shortcuts.
    for (const key of ["n", "e", "o", "h", "f"]) {
      expect(
        matchesCtrlOrMetaShortcut(keyEvent(key, { ctrlKey: true }), key, {
          platform: "mac",
        })
      ).toBe(false);
    }
  });

  it("on other platforms, Ctrl+Z still triggers undo", () => {
    expect(
      matchesCtrlOrMetaShortcut(keyEvent("z", { ctrlKey: true }), "z", {
        platform: "other",
      })
    ).toBe(true);
  });

  it("on other platforms, Cmd+Z also triggers undo and Ctrl+Cmd together still matches", () => {
    expect(
      matchesCtrlOrMetaShortcut(keyEvent("z", { metaKey: true }), "z", {
        platform: "other",
      })
    ).toBe(true);
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("z", { ctrlKey: true, metaKey: true }),
        "z",
        { platform: "other" }
      )
    ).toBe(true);
  });

  it("keeps exact shift matching on macOS too", () => {
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("Z", { metaKey: true, shiftKey: true }),
        "z",
        { platform: "mac" }
      )
    ).toBe(false);
    expect(
      matchesCtrlOrMetaShortcut(
        keyEvent("Z", { metaKey: true, shiftKey: true }),
        "z",
        { platform: "mac", shiftKey: true }
      )
    ).toBe(true);
  });
});

describe("detectShortcutPlatform", () => {
  it("detects macOS from navigator.platform", () => {
    expect(detectShortcutPlatform({ platform: "MacIntel", userAgent: "" })).toBe("mac");
    expect(detectShortcutPlatform({ platform: "MacPPC", userAgent: "" })).toBe("mac");
  });

  it("falls back to the user agent when platform is empty", () => {
    expect(
      detectShortcutPlatform({
        platform: "",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      })
    ).toBe("mac");
  });

  it("treats Windows, Linux and unknown platforms as non-mac", () => {
    expect(detectShortcutPlatform({ platform: "Win32", userAgent: "" })).toBe("other");
    expect(detectShortcutPlatform({ platform: "Linux x86_64", userAgent: "" })).toBe("other");
    expect(detectShortcutPlatform({ platform: "", userAgent: "" })).toBe("other");
    expect(detectShortcutPlatform({})).toBe("other");
  });

  it("falls back to the ambient navigator without throwing", () => {
    expect(["mac", "other"]).toContain(detectShortcutPlatform());
  });
});

describe("non-Latin keyboard layouts", () => {
  it("matches Ctrl+Z when a Cyrillic layout reports key 'я' at physical KeyZ", () => {
    expect(
      matchesOtherPlatform(
        keyEvent("я", { code: "KeyZ", ctrlKey: true }),
        "z"
      )
    ).toBe(true);
  });

  it("matches Ctrl+Z when a Greek layout reports key 'ζ' at physical KeyZ", () => {
    expect(
      matchesOtherPlatform(
        keyEvent("ζ", { code: "KeyZ", ctrlKey: true }),
        "z"
      )
    ).toBe(true);
  });

  it("matches Cmd+Z when a Hebrew layout reports key 'ז' at physical KeyZ", () => {
    expect(
      matchesOtherPlatform(
        keyEvent("ז", { code: "KeyZ", metaKey: true }),
        "z"
      )
    ).toBe(true);
  });

  it("keeps undo and redo distinct on non-Latin layouts via exact shift matching", () => {
    const shifted = keyEvent("Я", { code: "KeyZ", ctrlKey: true, shiftKey: true });
    expect(matchesOtherPlatform(shifted, "z")).toBe(false);
    expect(matchesOtherPlatform(shifted, "z", { shiftKey: true })).toBe(true);

    const unshifted = keyEvent("я", { code: "KeyZ", ctrlKey: true });
    expect(matchesOtherPlatform(unshifted, "z")).toBe(true);
    expect(matchesOtherPlatform(unshifted, "z", { shiftKey: true })).toBe(false);
  });

  it("still excludes AltGr combinations on non-Latin layouts", () => {
    expect(
      matchesOtherPlatform(
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
      matchesOtherPlatform(
        keyEvent("y", { code: "KeyZ", ctrlKey: true }),
        "z"
      )
    ).toBe(false);
    // ...while the key actually labeled Z on that layout (physical KeyY)
    // still matches through its key value, exactly as before.
    expect(
      matchesOtherPlatform(
        keyEvent("z", { code: "KeyY", ctrlKey: true }),
        "z"
      )
    ).toBe(true);
  });

  it("does not match when the physical key position is different", () => {
    expect(
      matchesOtherPlatform(
        keyEvent("я", { code: "KeyX", ctrlKey: true }),
        "z"
      )
    ).toBe(false);
  });

  it("does not match a non-Latin key when the event carries no code", () => {
    expect(
      matchesOtherPlatform(keyEvent("я", { ctrlKey: true }), "z")
    ).toBe(false);
  });

  it("keeps US-layout behavior unchanged", () => {
    expect(
      matchesOtherPlatform(
        keyEvent("z", { code: "KeyZ", ctrlKey: true }),
        "z"
      )
    ).toBe(true);
    expect(
      matchesOtherPlatform(
        keyEvent("y", { code: "KeyY", ctrlKey: true }),
        "z"
      )
    ).toBe(false);
  });

  it("matches the other letter shortcuts on non-Latin layouts too", () => {
    // Cyrillic 'эс' layout positions: physical KeyF reports 'а', KeyS reports
    // 'ы' — the letters differ, only the physical position is stable.
    expect(
      matchesOtherPlatform(
        keyEvent("а", { code: "KeyF", ctrlKey: true }),
        "f"
      )
    ).toBe(true);
    expect(
      matchesOtherPlatform(
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
