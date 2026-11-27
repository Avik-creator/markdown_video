"use client";

import { useSyncExternalStore } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { detectShortcutPlatform } from "./video-editor/utils/keyboard";

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// The modifier label depends on the visitor's platform, which is unknowable
// on the server. useSyncExternalStore keeps the hydration contract honest:
// the server snapshot always renders "Ctrl" and macOS clients switch to "⌘"
// after hydration instead of mismatching the prerendered markup.
function subscribeToPlatform() {
  return () => {};
}

function getMacClientSnapshot() {
  return detectShortcutPlatform() === "mac";
}

function getMacServerSnapshot() {
  return false;
}

const shortcuts = [
  {
    category: "Playback",
    items: [
      { keys: ["Space"], description: "Play / Pause" },
      { keys: ["←"], description: "Previous frame" },
      { keys: ["→"], description: "Next frame" },
      { keys: ["Shift", "←"], description: "Previous scene" },
      { keys: ["Shift", "→"], description: "Next scene" },
      { keys: ["Home"], description: "Go to start" },
      { keys: ["End"], description: "Go to end" },
      { keys: ["["], description: "Decrease speed" },
      { keys: ["]"], description: "Increase speed" },
    ],
  },
  {
    category: "Editor",
    items: [
      { keys: ["Ctrl", "Z"], description: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], description: "Redo" },
      { keys: ["Ctrl", "/"], description: "Toggle comment" },
      { keys: ["Ctrl", "I"], description: "Insert scene or directive" },
      { keys: ["Ctrl", "F"], description: "Find" },
      { keys: ["Ctrl", "H"], description: "Find & Replace" },
      { keys: ["Ctrl", "N"], description: "New project" },
      { keys: ["Ctrl", "O"], description: "Open project" },
      { keys: ["Ctrl", "S"], description: "Save project" },
    ],
  },
  {
    category: "View",
    items: [
      { keys: ["?"], description: "Toggle syntax guide" },
      { keys: ["T"], description: "Toggle templates" },
      { keys: ["F"], description: "Toggle fullscreen" },
      { keys: ["+"], description: "Zoom in" },
      { keys: ["-"], description: "Zoom out" },
      { keys: ["0"], description: "Reset zoom" },
    ],
  },
  {
    category: "Export",
    items: [
      { keys: ["Ctrl", "E"], description: "Export video" },
      { keys: ["M"], description: "Add marker at current time" },
    ],
  },
];

export function KeyboardShortcuts({
  open,
  onOpenChange,
}: KeyboardShortcutsProps) {
  const isMac = useSyncExternalStore(
    subscribeToPlatform,
    getMacClientSnapshot,
    getMacServerSnapshot
  );
  // Application shortcuts are Cmd-only on macOS, where bare Ctrl+letter keys
  // belong to emacs-style text editing; elsewhere Ctrl (or Cmd) fires them.
  const modifierKey = isMac ? "⌘" : "Ctrl";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-panel border-border text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 mt-4">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-medium text-accent mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j}>
                          <kbd className="px-1.5 py-0.5 bg-panel-raised rounded text-xs font-mono text-foreground">
                            {key === "Ctrl" ? modifierKey : key}
                          </kbd>
                          {j < shortcut.keys.length - 1 && (
                            <span className="text-zinc-600 mx-0.5">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="px-1 py-0.5 bg-panel-raised rounded text-xs font-mono">
              Esc
            </kbd>{" "}
            to close this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
