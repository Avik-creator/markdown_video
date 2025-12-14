"use client";

import type React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@components/ui/dialog";
import { Film } from "lucide-react";
import { useVideoStore } from "@/lib/use-video-store";
import { ExportList } from "./components";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewRef?: React.RefObject<HTMLDivElement | null>;
}

export function ExportModal({
  open,
  onOpenChange,
  previewRef,
}: ExportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-pink-500" />
            Export Video with FFmpeg
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configure and export your video using FFmpeg WASM
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <ExportList />
        </div>
      </DialogContent>
    </Dialog>
  );
}
