"use client";

import { useId } from "react";
import { Languages } from "lucide-react";
import { useVideoStore } from "@/lib/use-video-store";
import { resolveEffectiveLocale } from "@/lib/parser/i18n";
import { cn } from "@/lib/utils";

/**
 * Document-aware preview locale selector.
 *
 * The picker is intentionally a native select: it is compact, screen-reader
 * labeled, and keyboard operable without a custom menu implementation. It is
 * hidden for monolingual documents (no document-level `!locales`). The parent
 * preview/header layout owns placement; this component must remain outside the
 * `[data-scene-preview]` capture subtree so export frames never include UI.
 */
export function LocalePicker({ className }: { className?: string }) {
  const locales = useVideoStore((state) => state.locales);
  const defaultLocale = useVideoStore((state) => state.defaultLocale);
  const activeLocale = useVideoStore((state) => state.activeLocale);
  const setActiveLocale = useVideoStore((state) => state.setActiveLocale);
  const selectId = useId();

  if (locales.length === 0) return null;

  const effectiveLocale = resolveEffectiveLocale({
    activeLocale,
    locales,
    defaultLocale,
  });

  return (
    <div
      data-locale-picker="true"
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-200 shadow-sm backdrop-blur",
        className
      )}
    >
      <Languages className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
      <label htmlFor={selectId} className="text-neutral-400">
        Locale
      </label>
      <select
        id={selectId}
        value={effectiveLocale ?? ""}
        onChange={(event) => setActiveLocale(event.target.value)}
        className="cursor-pointer rounded bg-transparent font-medium text-neutral-100 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-pink-500"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale} className="bg-neutral-950 text-neutral-100">
            {locale}
          </option>
        ))}
      </select>
    </div>
  );
}
