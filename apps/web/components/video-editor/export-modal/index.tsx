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
    <div className="mb-4 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
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
      <DialogContent className="bg-panel border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-accent" />
            Export Video
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Rendered locally in your browser.
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
