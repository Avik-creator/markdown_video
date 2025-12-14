"use client"

import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Star, Save, Trash2 } from "lucide-react"
import type { ExportPreset } from "../utils/export-utils"

interface ExportPresetsProps {
  presets: ExportPreset[]
  selectedPreset: string | null
  presetName: string
  showSavePreset: boolean
  onLoadPreset: (presetId: string) => void
  onDeletePreset: (presetId: string) => void
  onSavePreset: () => void
  onCancelSave: () => void
  onStartSave: () => void
  onPresetNameChange: (name: string) => void
}

export function ExportPresets({
  presets,
  selectedPreset,
  presetName,
  showSavePreset,
  onLoadPreset,
  onDeletePreset,
  onSavePreset,
  onCancelSave,
  onStartSave,
  onPresetNameChange,
}: ExportPresetsProps) {
  if (presets.length === 0 && !showSavePreset) {
    return (
      <Button
        onClick={onStartSave}
        variant="outline"
        className="w-full gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
      >
        <Save className="w-4 h-4" />
        Save as Preset
      </Button>
    )
  }

  return (
    <div className="space-y-3">
      {presets.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-zinc-400 flex items-center gap-2">
            <Star className="w-3.5 h-3.5" />
            Saved Presets
          </Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className={`group flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${selectedPreset === preset.id
                  ? "bg-pink-500/20 text-pink-400 border border-pink-500/50"
                  : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600"
                  }`}
                onClick={() => onLoadPreset(preset.id)}
              >
                <span>{preset.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeletePreset(preset.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 ml-1 text-zinc-500 hover:text-red-400 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSavePreset ? (
        <div className="flex gap-2">
          <Input
            value={presetName}
            onChange={(e) => onPresetNameChange(e.target.value)}
            placeholder="Preset name..."
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            onKeyDown={(e) => e.key === "Enter" && onSavePreset()}
          />
          <Button
            onClick={onSavePreset}
            disabled={!presetName.trim()}
            size="sm"
            className="bg-pink-500 hover:bg-pink-600 text-white shrink-0"
          >
            Save
          </Button>
          <Button
            onClick={onCancelSave}
            size="sm"
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 shrink-0"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          onClick={onStartSave}
          variant="outline"
          className="w-full gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
        >
          <Save className="w-4 h-4" />
          Save as Preset
        </Button>
      )}
    </div>
  )
}
