"use client";

import { Button } from "@components/ui/button";
import { Label } from "@components/ui/label";
import { Film } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { Settings, Zap, Download } from "lucide-react";
import { estimatedTime } from "../utils/export-utils";

interface ExportSettingsProps {
  quality: string;
  resolution: string;
  fps: string;
  format?: string;
  totalDuration: number;
  onQualityChange: (quality: string) => void;
  onResolutionChange: (resolution: string) => void;
  onFpsChange: (fps: string) => void;
  onFormatChange?: (format: string) => void;
  onExport: () => void;
}

export function ExportSettings({
  quality,
  resolution,
  fps,
  format = "mp4",
  totalDuration,
  onQualityChange,
  onResolutionChange,
  onFpsChange,
  onFormatChange,
  onExport,
}: ExportSettingsProps) {
  return (
    <div className="space-y-5 py-4">
      {/* Export Format */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-400 flex items-center gap-2">
          <Film className="w-3.5 h-3.5" />
          Export Format
        </Label>
        <Select value={format} onValueChange={onFormatChange}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem
              value="mp4"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              MP4 - Standard video format (16:9)
            </SelectItem>
            <SelectItem
              value="reels"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              Instagram Reels - Optimized for mobile (9:16)
            </SelectItem>
            <SelectItem
              value="shorts"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              YouTube Shorts - Mobile vertical (9:16)
            </SelectItem>
            <SelectItem
              value="gif"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              Animated GIF - Looping format
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-zinc-500 mt-1">
          {format === "reels" &&
            "Perfect for Instagram Reels with safe area for notches"}
          {format === "shorts" &&
            "Optimized for YouTube Shorts vertical format"}
          {format === "gif" && "Create shareable animated GIF"}
          {format === "mp4" && "Standard MP4 video format for all platforms"}
        </p>
      </div>

      {/* Quality Preset */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-400 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          Export Quality
        </Label>
        <Select value={quality} onValueChange={onQualityChange}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem
              value="fast"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              Fast - Good quality, faster export
            </SelectItem>
            <SelectItem
              value="balanced"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              Balanced - High quality, smooth playback
            </SelectItem>
            <SelectItem
              value="quality"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              Ultra - Best quality, crisp output
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resolution */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-400">Resolution</Label>
        <Select value={resolution} onValueChange={onResolutionChange}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem
              value="720p"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              720p (1280x720)
            </SelectItem>
            <SelectItem
              value="1080p"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              1080p (1920x1080)
            </SelectItem>
            <SelectItem
              value="1440p"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              1440p (2560x1440)
            </SelectItem>
            <SelectItem
              value="4k"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              4K (3840x2160)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Frame Rate */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-400">Frame Rate</Label>
        <Select value={fps} onValueChange={onFpsChange}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem
              value="24"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              24 fps (Cinematic)
            </SelectItem>
            <SelectItem
              value="30"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              30 fps (Standard)
            </SelectItem>
            <SelectItem
              value="60"
              className="text-zinc-300 focus:bg-zinc-700 focus:text-white"
            >
              60 fps (Smooth)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Info */}
      <div className="flex items-center justify-between text-sm bg-zinc-800 rounded-lg p-3">
        <div className="flex items-center gap-2 text-zinc-400">
          <Settings className="w-4 h-4" />
          <span>Duration: {totalDuration.toFixed(1)}s</span>
        </div>
        <span className="text-zinc-400">
          Est. time: {estimatedTime(totalDuration, fps, quality)}
        </span>
      </div>

      {/* Export button */}
      <Button
        onClick={onExport}
        className="w-full gap-2 bg-pink-500 hover:bg-pink-600 text-white"
      >
        <Download className="w-4 h-4" />
        Export Video
      </Button>
    </div>
  );
}
