"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@components/ui/dialog";
import { Film } from "lucide-react";
import ExportList from "./components/ExportList";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportModal({ open, onOpenChange }: ExportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
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
