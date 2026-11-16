"use client";
import { useVideoStore } from "@/lib/use-video-store";
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CircleX,
  FileText,
  MousePointerClick,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CornerMarkers from "@components/CornerMarkers";
import { EXAMPLE_TEMPLATES } from "@/lib/editor/snippets";
import {
  applyFix,
  diagnosticsByLine,
  getDiagnostics,
  type Diagnostic,
} from "@/lib/editor/diagnostics";
import {
  getCompletions,
  type Completion,
  type CompletionResult,
} from "@/lib/editor/completions";

const LINE_HEIGHT = 20; // px, must match the textarea and overlay rows
const PADDING = 12; // px, the textarea's p-3
const LISTBOX_ID = "editor-completions";
const POPUP_WIDTH = 224; // px, w-56
const POPUP_MAX_HEIGHT = 224; // px, max-h-56
const CHECK_DELAY = 300; // ms after the last keystroke before re-validating

export function MarkdownEditor() {
  const markdown = useVideoStore((state) => state.markdown);
  const setMarkdown = useVideoStore((state) => state.setMarkdown);
  const highlightRange = useVideoStore((state) => state.highlightRange);
  const setHighlightRange = useVideoStore((state) => state.setHighlightRange);
  const [localMarkdown, setLocalMarkdown] = useState(markdown);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightOverlayRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [charWidth, setCharWidth] = useState(8.4);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [problemsOpen, setProblemsOpen] = useState(true);
  // Selection to apply once React has written new text into the textarea.
  // Setting it any later (rAF, setTimeout) races with the next keystroke.
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  // Re-validate once typing pauses, so half-typed words don't flash as errors.
  const [checkedMarkdown, setCheckedMarkdown] = useState(localMarkdown);
  useEffect(() => {
    const timeout = setTimeout(() => setCheckedMarkdown(localMarkdown), CHECK_DELAY);
    return () => clearTimeout(timeout);
  }, [localMarkdown]);
  const diagnostics = useMemo(
    () => getDiagnostics(checkedMarkdown),
    [checkedMarkdown]
  );
  const problemsByLine = useMemo(
    () => diagnosticsByLine(diagnostics),
    [diagnostics]
  );
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.length - errorCount;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMarkdown(localMarkdown);
    }, 500);
    return () => clearTimeout(timeout);
  }, [localMarkdown, setMarkdown]);

  useEffect(() => {
    setLocalMarkdown(markdown);
  }, [markdown]);

  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    if (selection && textareaRef.current) {
      textareaRef.current.setSelectionRange(selection.start, selection.end);
      pendingSelection.current = null;
    }
  }, [localMarkdown]);

  // Width of one monospace character, for placing the completion list.
  useEffect(() => {
    if (measureRef.current) {
      setCharWidth(measureRef.current.getBoundingClientRect().width / 10);
    }
  }, []);

  const syncScroll = useCallback((top: number, left: number) => {
    if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = top;
    if (highlightOverlayRef.current) {
      highlightOverlayRef.current.scrollTop = top;
      highlightOverlayRef.current.scrollLeft = left;
    }
    setScroll({ top, left });
  }, []);

  const scrollToLine = useCallback(
    (line: number) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const top = Math.max(
        0,
        (line - 1) * LINE_HEIGHT - textarea.clientHeight / 3
      );
      textarea.scrollTop = top;
      syncScroll(top, textarea.scrollLeft);
    },
    [syncScroll]
  );

  // Scroll to highlighted lines when highlight range changes
  useEffect(() => {
    if (highlightRange && textareaRef.current) {
      scrollToLine(highlightRange.startLine);

      const lines = localMarkdown.split("\n");
      let charPosition = 0;
      for (let i = 0; i < highlightRange.startLine - 1 && i < lines.length; i++) {
        charPosition += lines[i].length + 1; // +1 for newline
      }
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charPosition, charPosition);
    }
  }, [highlightRange, localMarkdown, scrollToLine]);

  // Keep the active completion visible while arrowing through the list.
  useEffect(() => {
    listboxRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const insertTemplate = (type: keyof typeof EXAMPLE_TEMPLATES) => {
    const template = EXAMPLE_TEMPLATES[type];
    const separator = localMarkdown.trim() ? "\n\n---\n\n" : "";
    const newMarkdown = localMarkdown + separator + template;
    setLocalMarkdown(newMarkdown);

    // Focus textarea after insert
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 0);
  };

  const toggleCommentLines = useCallback(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = localMarkdown;

    // Get the lines that are selected
    const beforeSelection = text.substring(0, start);
    const afterSelection = text.substring(end);

    // Find the start of the first line
    const lineStart = beforeSelection.lastIndexOf("\n") + 1;
    // Find the end of the last line
    const lineEnd =
      afterSelection.indexOf("\n") === -1
        ? text.length
        : end + afterSelection.indexOf("\n");

    const beforeLines = text.substring(0, lineStart);
    const selectedLines = text.substring(lineStart, lineEnd);
    const afterLines = text.substring(lineEnd);

    // Check if all selected lines are commented
    const lines = selectedLines.split("\n");
    const allCommented = lines.every((line) => line.trim().startsWith("//"));

    let newLines: string[];
    if (allCommented) {
      // Uncomment
      newLines = lines.map((line) => {
        const match = line.match(/^(\s*)\/\/\s?(.*)$/);
        return match ? match[1] + match[2] : line;
      });
    } else {
      // Comment
      newLines = lines.map((line) => {
        if (line.trim() === "") return line;
        const match = line.match(/^(\s*)(.*)$/);
        return match ? match[1] + "// " + match[2] : "// " + line;
      });
    }

    const newMarkdown = beforeLines + newLines.join("\n") + afterLines;
    setLocalMarkdown(newMarkdown);

    // Restore selection
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = lineStart;
        textareaRef.current.selectionEnd =
          lineStart + newLines.join("\n").length;
      }
    }, 0);
  }, [localMarkdown]);

  const handleScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    syncScroll(textarea.scrollTop, textarea.scrollLeft);
  }, [syncScroll]);

  const clearHighlight = useCallback(() => {
    if (highlightRange) {
      setHighlightRange(null);
    }
  }, [highlightRange, setHighlightRange]);

  const openCompletions = useCallback((text: string, cursor: number) => {
    setCompletion(getCompletions(text, cursor));
    setActiveIndex(0);
  }, []);

  const closeCompletions = useCallback(() => setCompletion(null), []);

  const acceptCompletion = useCallback(
    (item: Completion) => {
      if (!completion) return;
      const text = localMarkdown;
      const next =
        text.slice(0, completion.from) + item.insert + text.slice(completion.to);
      const cursor = completion.from + item.insert.length;
      pendingSelection.current = { start: cursor, end: cursor };
      setLocalMarkdown(next);
      // Chain into the next step, e.g. "type:" straight into its values.
      openCompletions(next, cursor);
      textareaRef.current?.focus();
    },
    [completion, localMarkdown, openCompletions]
  );

  // Character range of a 1-indexed line in the given text.
  const lineRange = (text: string, line: number) => {
    const lines = text.split("\n");
    let start = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      start += lines[i].length + 1;
    }
    return { start, end: start + (lines[line - 1]?.length ?? 0) };
  };

  // Select a line and bring it into view.
  const jumpToLine = useCallback(
    (line: number) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const { start, end } = lineRange(localMarkdown, line);
      textarea.focus();
      textarea.setSelectionRange(start, end);
      scrollToLine(line);
    },
    [localMarkdown, scrollToLine]
  );

  const fixProblem = useCallback(
    (d: Diagnostic) => {
      const next = applyFix(localMarkdown, d);
      if (d.line) {
        pendingSelection.current = lineRange(next, d.line);
        scrollToLine(d.line);
      }
      setLocalMarkdown(next);
      textareaRef.current?.focus();
    },
    [localMarkdown, scrollToLine]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (completion) {
      const count = completion.items.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % count);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + count) % count);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        acceptCompletion(completion.items[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeCompletions();
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "/") {
      e.preventDefault();
      toggleCommentLines();
    }
    // Ctrl+Space asks for completions explicitly.
    if (e.ctrlKey && e.key === " ") {
      e.preventDefault();
      openCompletions(localMarkdown, e.currentTarget.selectionStart);
    }
  };

  const lines = localMarkdown.split("\n");
  const lineCount = lines.length;

  // Place the completion list at the word being completed: below the line,
  // or above it when there isn't room, and never past the right edge.
  const popupPosition = useMemo(() => {
    if (!completion) return null;
    const area = editorAreaRef.current;
    const areaWidth = area?.clientWidth ?? 280;
    const areaHeight = area?.clientHeight ?? 600;
    const before = localMarkdown.slice(0, completion.from);
    const line = before.split("\n").length - 1;
    const column = completion.from - (before.lastIndexOf("\n") + 1);
    const lineTop = PADDING + line * LINE_HEIGHT - scroll.top;
    const below = areaHeight - (lineTop + LINE_HEIGHT);
    const left = Math.max(
      4,
      Math.min(PADDING + column * charWidth - scroll.left - 4, areaWidth - POPUP_WIDTH - 4)
    );
    const placeAbove = below < POPUP_MAX_HEIGHT && lineTop > below;
    return placeAbove
      ? { bottom: areaHeight - lineTop + 2, left, maxHeight: Math.min(POPUP_MAX_HEIGHT, lineTop - 4) }
      : { top: lineTop + LINE_HEIGHT + 2, left, maxHeight: Math.min(POPUP_MAX_HEIGHT, below - 4) };
  }, [completion, localMarkdown, scroll, charWidth]);

  const problemSummary = (line: number) =>
    problemsByLine
      .get(line)
      ?.map((d) => d.message)
      .join("\n");

  return (
    <div className="w-80 bg-white dark:bg-neutral-950 border-r border-gray-200 dark:border-neutral-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-neutral-100">
            Editor
          </h2>
          {highlightRange && (
            <button
              onClick={clearHighlight}
              className="flex items-center gap-1 text-xs text-pink-500 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/30 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-900/50 hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors"
            >
              <MousePointerClick className="w-3 h-3" />
              Line {highlightRange.startLine}
              {highlightRange.endLine !== highlightRange.startLine && `-${highlightRange.endLine}`}
              <span className="text-pink-400 dark:text-pink-500">×</span>
            </button>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-900 px-2 py-0.5 rounded">
          {lineCount} lines
        </span>
      </div>

      {/* Quick insert buttons */}
      <div className="p-2 border-b border-gray-200 dark:border-neutral-800 flex gap-2 flex-wrap shrink-0 bg-gray-50/50 dark:bg-neutral-900/50">
        {Object.entries(EXAMPLE_TEMPLATES).map(([key]) => (
          <button
            key={key}
            onClick={() =>
              insertTemplate(key as keyof typeof EXAMPLE_TEMPLATES)
            }
            className={cn(
              "group flex items-center justify-between gap-1 relative transition-all duration-300 ease-out",
              "hover:translate-x-[-2px]"
            )}
          >
            <CornerMarkers />
            <span className="text-sm font-serif font-semibold text-gray-900 dark:text-neutral-100 underline decoration-gray-500 dark:decoration-neutral-400/50 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Line numbers, marked where there are problems */}
        <div
          ref={lineNumbersRef}
          className="w-10 bg-gray-50 dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 overflow-hidden shrink-0 select-none"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="py-3">
            {lines.map((_, i) => {
              const lineNum = i + 1;
              const isHighlighted = highlightRange &&
                lineNum >= highlightRange.startLine &&
                lineNum <= highlightRange.endLine;
              const problems = problemsByLine.get(lineNum);
              const hasError = problems?.some((d) => d.severity === "error");

              return (
                <div
                  key={i}
                  title={problemSummary(lineNum)}
                  className={cn(
                    "relative text-xs font-mono text-right pr-2 transition-colors duration-200",
                    isHighlighted
                      ? "text-pink-500 dark:text-pink-400 font-semibold"
                      : problems
                      ? hasError
                        ? "text-red-600 dark:text-red-400 font-semibold"
                        : "text-amber-600 dark:text-amber-400 font-semibold"
                      : "text-gray-400 dark:text-neutral-600"
                  )}
                  style={{ height: `${LINE_HEIGHT}px`, lineHeight: `${LINE_HEIGHT}px` }}
                >
                  {problems && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full",
                        hasError ? "bg-red-500" : "bg-amber-500"
                      )}
                    />
                  )}
                  {lineNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* Editor container with highlight overlay */}
        <div ref={editorAreaRef} className="flex-1 relative overflow-hidden">
          {/* Highlight and problem overlay */}
          <div
            ref={highlightOverlayRef}
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="py-3 px-3">
              {lines.map((_, i) => {
                const lineNum = i + 1;
                const isHighlighted = highlightRange &&
                  lineNum >= highlightRange.startLine &&
                  lineNum <= highlightRange.endLine;

                const isFirstHighlighted = highlightRange && lineNum === highlightRange.startLine;
                const isLastHighlighted = highlightRange && lineNum === highlightRange.endLine;
                const problems = problemsByLine.get(lineNum);
                const hasError = problems?.some((d) => d.severity === "error");

                return (
                  <div
                    key={i}
                    className={cn(
                      "transition-all duration-300",
                      isHighlighted && "bg-pink-500/15 dark:bg-pink-500/20 border-l-2 border-pink-500",
                      isFirstHighlighted && "rounded-t-md",
                      isLastHighlighted && "rounded-b-md",
                      !isHighlighted && problems && "border-l-2",
                      !isHighlighted && problems && (hasError
                        ? "bg-red-500/10 border-red-500"
                        : "bg-amber-500/10 border-amber-500")
                    )}
                    style={{
                      height: `${LINE_HEIGHT}px`,
                      lineHeight: `${LINE_HEIGHT}px`,
                      marginLeft: isHighlighted || problems ? "-12px" : "0",
                      paddingLeft: isHighlighted || problems ? "10px" : "0",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Measures one monospace character in the textarea's font */}
          <span
            ref={measureRef}
            aria-hidden
            className="absolute invisible whitespace-pre text-sm font-mono"
          >
            0000000000
          </span>

          <textarea
            ref={textareaRef}
            value={localMarkdown}
            onChange={(e) => {
              setLocalMarkdown(e.target.value);
              clearHighlight();
              openCompletions(e.target.value, e.target.selectionStart);
            }}
            onScroll={handleScroll}
            onClick={() => {
              clearHighlight();
              closeCompletions();
            }}
            onBlur={closeCompletions}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-label="Scene markdown"
            aria-autocomplete="list"
            aria-expanded={completion !== null}
            aria-controls={LISTBOX_ID}
            aria-activedescendant={
              completion ? `${LISTBOX_ID}-${activeIndex}` : undefined
            }
            className="absolute inset-0 resize-none bg-transparent border-0 text-sm font-mono text-gray-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-0 p-3 overflow-auto whitespace-pre"
            wrap="off"
            placeholder="Enter your scene markdown..."
            spellCheck={false}
            style={{
              lineHeight: `${LINE_HEIGHT}px`,
              caretColor: "#ec4899",
              tabSize: 2,
            }}
          />

          {completion && popupPosition && (
            <ul
              ref={listboxRef}
              id={LISTBOX_ID}
              role="listbox"
              aria-label="Suggestions"
              className="absolute z-20 w-56 overflow-auto rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1 text-xs"
              style={popupPosition}
            >
              {completion.items.map((item, i) => (
                <li
                  key={item.label}
                  id={`${LISTBOX_ID}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === activeIndex}
                  // Keep focus in the textarea so typing can continue.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    acceptCompletion(item);
                  }}
                  // Hover is styling only. Changing the active item on hover
                  // lets a list that opens under a resting pointer steal
                  // the keyboard selection.
                  className={cn(
                    "px-2 py-1 cursor-pointer flex flex-col",
                    i === activeIndex
                      ? "bg-pink-50 dark:bg-pink-950/40"
                      : "hover:bg-gray-50 dark:hover:bg-neutral-800"
                  )}
                >
                  <span className="font-mono text-gray-900 dark:text-neutral-100">
                    {item.label}
                  </span>
                  {item.detail && (
                    <span className="text-[11px] text-gray-500 dark:text-neutral-500 truncate">
                      {item.detail}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {diagnostics.length > 0 ? (
        <ProblemsPanel
          diagnostics={diagnostics}
          errorCount={errorCount}
          warningCount={warningCount}
          open={problemsOpen}
          onToggle={() => setProblemsOpen((o) => !o)}
          onJump={jumpToLine}
          onFix={fixProblem}
        />
      ) : (
        /* Footer hint */
        <div className="p-3 border-t border-gray-200 dark:border-neutral-800 bg-linear-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 shrink-0">
          <p className="text-xs text-gray-600 dark:text-neutral-400 text-center">
            Press{" "}
            <kbd className="bg-white dark:bg-neutral-800 px-2 py-1 rounded text-xs font-mono text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-900 shadow-sm mx-1">
              ?
            </kbd>{" "}
            or click{" "}
            <span className="text-pink-600 dark:text-pink-400 font-medium">
              Guide
            </span>{" "}
            in header for syntax help
          </p>
        </div>
      )}
    </div>
  );
}

function ProblemsPanel({
  diagnostics,
  errorCount,
  warningCount,
  open,
  onToggle,
  onJump,
  onFix,
}: {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  open: boolean;
  onToggle: () => void;
  onJump: (line: number) => void;
  onFix: (d: Diagnostic) => void;
}) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <div className="border-t border-gray-200 dark:border-neutral-800 shrink-0 bg-gray-50 dark:bg-neutral-900">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
      >
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <CircleX className="w-3.5 h-3.5" />
            {plural(errorCount, "error")}
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {plural(warningCount, "warning")}
          </span>
        )}
        <span className="ml-auto text-gray-400 dark:text-neutral-500">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </span>
      </button>

      {open && (
        <ul className="max-h-40 overflow-auto border-t border-gray-200 dark:border-neutral-800">
          {diagnostics.map((d, i) => (
            <li
              key={`${d.line ?? "doc"}-${i}`}
              className="flex items-start gap-2 px-3 py-1.5 text-xs border-b border-gray-100 dark:border-neutral-800/60 last:border-b-0"
            >
              {d.severity === "error" ? (
                <CircleX className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
              )}
              <button
                onClick={() => d.line && onJump(d.line)}
                disabled={!d.line}
                className="flex-1 text-left min-w-0 disabled:cursor-default"
              >
                <span className="text-gray-900 dark:text-neutral-100">
                  {d.line && (
                    <span className="font-mono text-gray-400 dark:text-neutral-500 mr-1.5">
                      Ln {d.line}
                    </span>
                  )}
                  {d.message}
                </span>
                {d.suggestion && !d.fix && (
                  <span className="block text-gray-500 dark:text-neutral-500 truncate" title={d.suggestion}>
                    {d.suggestion}
                  </span>
                )}
              </button>
              {d.fix && (
                <button
                  onClick={() => onFix(d)}
                  className="shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40"
                >
                  <Wand2 className="w-3 h-3" />
                  Fix
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
