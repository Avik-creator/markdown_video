"use client"

import { useVideoStore } from "@/lib/use-video-store"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Palette, Check } from "lucide-react"

const THEME_PRESETS = {
  default: {
    name: "Default",
    colors: {
      background: "#0a0a0f",
      foreground: "#ffffff",
      accent: "#ec4899",
      muted: "#71717a",
    },
  },
  monokai: {
    name: "Monokai",
    colors: {
      background: "#272822",
      foreground: "#f8f8f2",
      accent: "#f92672",
      muted: "#75715e",
    },
  },
  dracula: {
    name: "Dracula",
    colors: {
      background: "#282a36",
      foreground: "#f8f8f2",
      accent: "#bd93f9",
      muted: "#6272a4",
    },
  },
  nord: {
    name: "Nord",
    colors: {
      background: "#2e3440",
      foreground: "#eceff4",
      accent: "#88c0d0",
      muted: "#4c566a",
    },
  },
  github: {
    name: "GitHub Dark",
    colors: {
      background: "#0d1117",
      foreground: "#c9d1d9",
      accent: "#58a6ff",
      muted: "#8b949e",
    },
  },
}

export type ThemePreset = keyof typeof THEME_PRESETS

export function ThemeSelector() {
  const theme = useVideoStore((state) => state.theme)
  const setTheme = useVideoStore((state) => state.setTheme)

  const currentTheme = THEME_PRESETS[theme] || THEME_PRESETS.default

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800">
          <Palette className="w-4 h-4" />
          <span className="text-xs">{currentTheme.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-zinc-900 border-zinc-800 w-48">
        {Object.entries(THEME_PRESETS).map(([key, preset]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => setTheme(key as ThemePreset)}
            className={`flex items-center justify-between ${theme === key ? "text-pink-400" : "text-zinc-300"}`}
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.colors.background }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.colors.accent }} />
              </div>
              <span className="text-sm">{preset.name}</span>
            </div>
            {theme === key && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { THEME_PRESETS }
