"use client";

import { useVideoStore } from "@/lib/use-video-store";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Monitor, Sparkles, Zap } from "lucide-react";

export default function RenderOptions() {
  const exportSettings = useVideoStore((state) => state.exportSettings);
  const setExportSettings = useVideoStore((state) => state.setExportSettings);
  const totalDuration = useVideoStore((state) => state.totalDuration);

  return (
    <div className="space-y-5 pb-4">
      {/* Resolution Setting */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-400 flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5" />
          Resolution
        </Label>
        <Select
          value={exportSettings.resolution}
          onValueChange={(value) => setExportSettings({ resolution: value })}
        >
          <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
            <SelectValue placeholder="Select resolution" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem value="480p" className="text-white hover:bg-zinc-700">480p (SD)</SelectItem>
            <SelectItem value="720p" className="text-white hover:bg-zinc-700">720p (HD)</SelectItem>
            <SelectItem value="1080p" className="text-white hover:bg-zinc-700">1080p (Full HD)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quality Setting */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-400 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          Quality
        </Label>
        <Select
          value={exportSettings.quality}
          onValueChange={(value) => setExportSettings({ quality: value })}
        >
          <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
            <SelectValue placeholder="Select quality" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem value="low" className="text-white hover:bg-zinc-700">Low (Fastest)</SelectItem>
            <SelectItem value="medium" className="text-white hover:bg-zinc-700">Medium</SelectItem>
            <SelectItem value="high" className="text-white hover:bg-zinc-700">High</SelectItem>
            <SelectItem value="ultra" className="text-white hover:bg-zinc-700">Ultra (Best)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Processing Speed Setting */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-400 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          Processing Speed
        </Label>
        <Select
          value={exportSettings.speed}
          onValueChange={(value) => setExportSettings({ speed: value })}
        >
          <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
            <SelectValue placeholder="Select speed" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem value="fastest" className="text-white hover:bg-zinc-700">Fastest</SelectItem>
            <SelectItem value="fast" className="text-white hover:bg-zinc-700">Fast</SelectItem>
            <SelectItem value="balanced" className="text-white hover:bg-zinc-700">Balanced</SelectItem>
            <SelectItem value="slow" className="text-white hover:bg-zinc-700">Slow</SelectItem>
            <SelectItem value="slowest" className="text-white hover:bg-zinc-700">Slowest (Best)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary info */}
      <div className="flex items-center justify-between text-sm bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
        <div className="flex items-center gap-2 text-zinc-400">
          <span>Duration: {totalDuration.toFixed(1)}s</span>
        </div>
        <span className="text-zinc-500">
          {exportSettings.resolution} • {exportSettings.quality} quality
        </span>
      </div>
    </div>
  );
}
