"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface KeyboardShortcutsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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
      { keys: ["Ctrl", "F"], description: "Find" },
      { keys: ["Ctrl", "H"], description: "Find & Replace" },
      { keys: ["Ctrl", "S"], description: "Save project" },
      { keys: ["Ctrl", "O"], description: "Open project" },
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
]

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 mt-4">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-medium text-pink-400 mb-3">{section.category}</h3>
              <div className="space-y-2">
                {section.items.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j}>
                          <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs font-mono text-zinc-300">{key}</kbd>
                          {j < shortcut.keys.length - 1 && <span className="text-zinc-600 mx-0.5">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500">
            Press <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-xs font-mono">Esc</kbd> to close this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
