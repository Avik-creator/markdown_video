"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@components/ui/dialog";
import { useEffect, useState } from "react";
import { AlertTriangle, Film } from "lucide-react";
import ExportList from "./components/ExportList";
import { useVideoStore } from "@/lib/use-video-store";
import {
  ensureAssetLibraryLoaded,
  useAssetLibrary,
} from "@/lib/assets/asset-library";
import {
  findMissingAssetReferences,
  type MissingAssetReference,
} from "@/lib/assets/missing-assets";

function MissingAssetExportNotice() {
  const markdown = useVideoStore((state) => state.markdown);
  const assets = useAssetLibrary((state) => state.assets);
  const [missing, setMissing] = useState<MissingAssetReference[]>([]);

  useEffect(() => {
    let cancelled = false;
    void ensureAssetLibraryLoaded()
      .then(() =>
        findMissingAssetReferences(markdown, { assets })
      )
      .then((references) => {
        if (!cancelled) setMissing(references);
      })
      .catch(() => {
        if (!cancelled) setMissing([]);
      });
    return () => {
      cancelled = true;
    };
  }, [assets, markdown]);

  if (missing.length === 0) return null;

  return (
    <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" />
        Missing media will not export as uploaded content
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {missing.map((reference) => (
          <p key={`${reference.kind}:${reference.filename}:${reference.lineNumber}`}>
            Line {reference.lineNumber}: <code>./{reference.filename}</code> is not in browser assets or static files.
          </p>
        ))}
      </div>
    </div>
  );
}

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
          <MissingAssetExportNotice />
          <ExportList />
        </div>
      </DialogContent>
    </Dialog>
  );
}
