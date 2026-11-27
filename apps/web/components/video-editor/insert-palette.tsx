"use client";

import { useMemo, useState } from "react";
import { FilePlus2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { INSERTABLE_SNIPPETS, type InsertableSnippet } from "@/lib/editor/snippets";
import { cn } from "@/lib/utils";

interface InsertPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (snippet: InsertableSnippet) => boolean;
}

function matchesQuery(snippet: InsertableSnippet, query: string): boolean {
  const haystack = [snippet.name, snippet.description, snippet.id, ...snippet.keywords]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part));
}

function rankSnippet(snippet: InsertableSnippet, query: string): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 0;
  if (snippet.name.toLowerCase().includes(normalized)) return 0;
  if (snippet.id.toLowerCase().includes(normalized)) return 1;
  if (snippet.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))) return 2;
  if (snippet.description.toLowerCase().includes(normalized)) return 3;
  return 4;
}

/**
 * Searchable insertion surface for the same schema-validated scene snippets
 * used by the editor's quick-insert path. It is intentionally not a second
 * template engine: selecting a row only chooses which existing snippet the
 * editor inserts structurally at the correct scene boundary.
 */
export function InsertPalette({ open, onOpenChange, onInsert }: InsertPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(
    () =>
      INSERTABLE_SNIPPETS
        .map((snippet, index) => ({ snippet, index }))
        .filter(({ snippet }) => matchesQuery(snippet, query))
        .sort((a, b) => rankSnippet(a.snippet, query) - rankSnippet(b.snippet, query) || a.index - b.index)
        .map(({ snippet }) => snippet),
    [query]
  );
  const clampedActiveIndex = filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);
  const active = filtered[clampedActiveIndex];

  const closeAndReset = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setActiveIndex(0);
    }
    onOpenChange(nextOpen);
  };

  const insert = (snippet: InsertableSnippet) => {
    if (onInsert(snippet)) {
      closeAndReset(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      <DialogContent className="max-w-3xl overflow-hidden border-gray-200 bg-white p-0 text-gray-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
        <DialogHeader className="border-b border-gray-200 px-5 py-4 dark:border-neutral-800">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FilePlus2 className="h-4 w-4 text-pink-500 dark:text-pink-400" />
            Insert scene or directive
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-neutral-400">
            Search scene scaffolds and common directives. Scenes insert after the cursor scene; directives insert inside it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)]">
          <div className="flex min-h-0 flex-col border-b border-gray-200 md:border-b-0 md:border-r dark:border-neutral-800">
            <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-neutral-800">
              <Search className="h-4 w-4 shrink-0 text-gray-400 dark:text-neutral-500" />
              <input
                autoFocus
                role="combobox"
                aria-expanded="true"
                aria-controls="insert-palette-listbox"
                aria-activedescendant={active ? `insert-option-${"kind" in active ? "directive" : "scene"}-${active.id}` : undefined}
                aria-label="Search scenes or directives"
                value={query}
                placeholder="Search scenes or directives…"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.min(index + 1, Math.max(0, filtered.length - 1)));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(0, index - 1));
                  } else if (event.key === "Enter" && active) {
                    event.preventDefault();
                    insert(active);
                  }
                }}
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-neutral-500"
              />
              <kbd className="whitespace-nowrap rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                ⌘/Ctrl I
              </kbd>
            </div>

            <ul
              id="insert-palette-listbox"
              role="listbox"
              aria-label="Scenes and directives"
              className="min-h-64 flex-1 overflow-y-auto p-2"
            >
              {filtered.map((snippet, index) => {
                const selected = index === clampedActiveIndex;
                return (
                  <li key={`${"kind" in snippet ? "directive" : "scene"}-${snippet.id}`} role="presentation">
                    <button
                      id={`insert-option-${"kind" in snippet ? "directive" : "scene"}-${snippet.id}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => insert(snippet)}
                      className={cn(
                        "w-full rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500",
                        selected
                          ? "bg-pink-50 text-gray-900 dark:bg-pink-950/25 dark:text-neutral-100"
                          : "text-gray-700 hover:bg-gray-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{snippet.name}</span>
                        <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-400 dark:border-neutral-800 dark:text-neutral-500">
                          {"kind" in snippet ? "Directive" : "Scene"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
                        {snippet.description}
                      </p>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-3 py-10 text-center text-sm text-gray-500 dark:text-neutral-400">
                  No snippets match “{query}”
                </li>
              )}
            </ul>
          </div>

          <div className="flex min-h-0 flex-col bg-gray-50/70 dark:bg-neutral-900/40">
            <div className="border-b border-gray-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:text-neutral-400">
              Markdown preview
            </div>
            <pre className="min-h-48 flex-1 overflow-auto p-4 font-mono text-xs leading-5 text-gray-700 dark:text-neutral-300">
              {active?.markdown ?? "Select a snippet to preview its markdown."}
            </pre>
            <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-neutral-800 dark:text-neutral-400">
              ↑↓ navigate · Enter insert · Esc close
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
