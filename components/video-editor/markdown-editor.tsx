"use client";
import { useVideoStore } from "@/lib/use-video-store";
import {
  forwardRef,
  useEffect,
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
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
import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { setDiagnostics } from "@codemirror/lint";
import { cn } from "@/lib/utils";
import CornerMarkers from "@components/CornerMarkers";
import { EXAMPLE_TEMPLATES } from "@/lib/editor/snippets";
import {
  diagnosticsByLine,
  getDiagnostics,
  type Diagnostic,
} from "@/lib/editor/diagnostics";
import { createEditorExtensions } from "@/lib/editor/codemirror/extensions";
import {
  EditorStoreSync,
  registerActiveEditorFlush,
  registerActiveEditorView,
} from "@/lib/editor/codemirror/store-sync";
import {
  MARKDOWN_EDITOR_CSS_VARS,
} from "@/lib/editor/codemirror/theme";
import {
  diagnosticFixChange,
  toCmDiagnostics,
} from "@/lib/editor/codemirror/lint-sync";
import {
  setEditorMarkersEffect,
  type EditorMarkers,
} from "@/lib/editor/codemirror/line-marks";

export interface MarkdownEditorHandle {
  /** Select a character range and scroll it into view without stealing focus. */
  selectRange: (start: number, end: number) => void;
  /** Read the editor's current character selection (UTF-16 offsets). */
  getSelection: () => { start: number; end: number } | null;
  /** Read the live document text, including uncommitted typing. */
  getText: () => string | null;
  /** Commit any uncommitted typing to the store synchronously. */
  flushPending: () => void;
  /** Replace a range of the live document, committed like a user edit. */
  replaceRange: (from: number, to: number, text: string) => void;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle>(function MarkdownEditor(
  _,
  ref
) {
  const highlightRange = useVideoStore((state) => state.highlightRange);
  const setHighlightRange = useVideoStore((state) => state.setHighlightRange);

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const syncRef = useRef<EditorStoreSync | null>(null);
  // Latest inputs for the combined line/gutter marker decorations, so a
  // validation pass and a highlight change can each rebuild the full set.
  const markersRef = useRef<EditorMarkers>({
    highlight: null,
    problemsByLine: new Map(),
  });

  const [diagnostics, setDiagnosticsState] = useState<Diagnostic[]>([]);
  const [problemsOpen, setProblemsOpen] = useState(true);
  const [lineCount, setLineCount] = useState(0);

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.length - errorCount;

  const dispatchMarkers = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setEditorMarkersEffect.of({
        highlight: markersRef.current.highlight,
        problemsByLine: markersRef.current.problemsByLine,
      }),
    });
  }, []);

  // Scroll a document position to roughly one third down the viewport, the
  // same landing spot the textarea implementation computed manually.
  const scrollPosIntoView = useCallback((view: EditorView, pos: number) => {
    return EditorView.scrollIntoView(pos, {
      y: "start",
      yMargin: Math.max(0, view.dom.clientHeight / 3),
    });
  }, []);

  // Editor creation. The view is created once per mount and owns the live
  // document; React never mirrors keystrokes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const state = EditorState.create({
      doc: useVideoStore.getState().markdown,
      extensions: createEditorExtensions({
        onUpdate: (update) => {
          syncRef.current?.handleUpdate(update);
          if (update.docChanged) {
            setLineCount(update.state.doc.lines);
          }
        },
        onEditorMouseDown: () => {
          // Clicking into the text clears the source-range highlight.
          if (useVideoStore.getState().highlightRange) {
            useVideoStore.getState().setHighlightRange(null);
          }
        },
        onEditorBlur: () => {
          // Commit pending keystrokes before another panel (notably Find)
          // starts reading or replacing the shared document.
          syncRef.current?.flushPending();
        },
      }),
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    setLineCount(state.doc.lines);

    const sync = new EditorStoreSync({
      view,
      onValidate: (text) => {
        const nextDiagnostics = getDiagnostics(text);
        setDiagnosticsState(nextDiagnostics);
        const liveView = viewRef.current;
        if (!liveView) return;
        liveView.dispatch(
          setDiagnostics(
            liveView.state,
            toCmDiagnostics(liveView.state.doc, nextDiagnostics)
          )
        );
        markersRef.current = {
          highlight: useVideoStore.getState().highlightRange,
          problemsByLine: diagnosticsByLine(nextDiagnostics),
        };
        dispatchMarkers();
      },
      onUserEdit: () => {
        // Any user edit clears the source-range highlight.
        if (useVideoStore.getState().highlightRange) {
          useVideoStore.getState().setHighlightRange(null);
        }
      },
    });
    syncRef.current = sync;

    // Validate the initial document immediately, matching the textarea
    // version which had diagnostics from the first render.
    sync.validateNow();

    // While mounted, this editor owns the cross-component flush seam.
    const flush = () => sync.flushPending();
    registerActiveEditorFlush(flush);
    registerActiveEditorView(view);

    return () => {
      registerActiveEditorFlush(null);
      registerActiveEditorView(null);
      sync.destroy();
      view.destroy();
      viewRef.current = null;
      syncRef.current = null;
    };
  }, [dispatchMarkers]);

  // Keep marker decorations in sync with highlight-only changes. Validation
  // passes already rebuild the full set; this covers the highlight changing
  // without a revalidation (property panel clicks, user edits clearing it).
  useEffect(() => {
    markersRef.current = {
      ...markersRef.current,
      highlight: highlightRange,
    };
    dispatchMarkers();

    const view = viewRef.current;
    if (!view || !highlightRange) return;

    // Bring the highlighted source into view with the caret at its first
    // line, matching the textarea behavior.
    const lineNumber = Math.max(1, Math.min(highlightRange.startLine, view.state.doc.lines));
    const line = view.state.doc.line(lineNumber);
    view.dispatch({
      selection: EditorSelection.cursor(line.from),
      effects: scrollPosIntoView(view, line.from),
    });
    view.contentDOM.focus();
  }, [highlightRange, dispatchMarkers, scrollPosIntoView]);

  const selectLine = useCallback(
    (lineNumber: number) => {
      const view = viewRef.current;
      if (!view) return;
      const clamped = Math.max(1, Math.min(lineNumber, view.state.doc.lines));
      const line = view.state.doc.line(clamped);
      view.dispatch({
        selection: EditorSelection.range(line.from, line.to),
        effects: scrollPosIntoView(view, line.from),
      });
      view.contentDOM.focus();
    },
    [scrollPosIntoView]
  );

  useImperativeHandle(
    ref,
    () => ({
      selectRange: (start: number, end: number) => {
        const view = viewRef.current;
        if (!view) return;
        const length = view.state.doc.length;
        const selectionStart = Math.max(0, Math.min(start, length));
        const selectionEnd = Math.max(selectionStart, Math.min(end, length));
        const range = EditorSelection.range(selectionStart, selectionEnd);
        view.dispatch({
          selection: range,
          effects: EditorView.scrollIntoView(range, {
            y: "start",
            yMargin: Math.max(0, view.dom.clientHeight / 3),
            x: "center",
          }),
        });
      },
      getSelection: () => {
        const view = viewRef.current;
        if (!view) return null;
        const range = view.state.selection.main;
        return { start: range.from, end: range.to };
      },
      getText: () => {
        const view = viewRef.current;
        return view ? view.state.doc.toString() : null;
      },
      flushPending: () => {
        syncRef.current?.flushPending();
      },
      replaceRange: (from: number, to: number, text: string) => {
        const view = viewRef.current;
        if (!view) return;
        const length = view.state.doc.length;
        const clampedFrom = Math.max(0, Math.min(from, length));
        const clampedTo = Math.max(clampedFrom, Math.min(to, length));
        view.dispatch({
          changes: { from: clampedFrom, to: clampedTo, insert: text },
        });
      },
    }),
    []
  );

  const insertTemplate = (type: keyof typeof EXAMPLE_TEMPLATES) => {
    const view = viewRef.current;
    if (!view) return;
    const template = EXAMPLE_TEMPLATES[type];
    const text = view.state.doc.toString();
    const separator = text.trim() ? "\n\n---\n\n" : "";
    const insert = separator + template;
    const from = view.state.doc.length;
    view.dispatch({
      changes: { from, insert },
      selection: EditorSelection.cursor(from + insert.length),
      effects: EditorView.scrollIntoView(from + insert.length, { y: "end" }),
    });
    view.contentDOM.focus();
  };

  const clearHighlight = useCallback(() => {
    if (highlightRange) {
      setHighlightRange(null);
    }
  }, [highlightRange, setHighlightRange]);

  const jumpToLine = useCallback(
    (line: number) => {
      selectLine(line);
    },
    [selectLine]
  );

  const fixProblem = useCallback(
    (d: Diagnostic) => {
      const view = viewRef.current;
      if (!view) return;
      const change = diagnosticFixChange(view.state.doc, d);
      if (change) {
        view.dispatch({
          changes: { from: change.from, to: change.to, insert: change.insert },
        });
      }
      if (d.line) {
        selectLine(d.line);
      } else {
        view.contentDOM.focus();
      }
    },
    [selectLine]
  );

  return (
    <div className="w-80 bg-white dark:bg-neutral-950 border-r border-gray-200 dark:border-neutral-800 flex flex-col h-full overflow-hidden">
      <style>{MARKDOWN_EDITOR_CSS_VARS}</style>
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

      {/* CodeMirror mounts here and owns the live document. */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div
          ref={hostRef}
          className="cm-md-editor-host flex-1 min-h-0 min-w-0"
          data-testid="codemirror-host"
        />
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
});

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
