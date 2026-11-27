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
  Plus,
  Wand2,
} from "lucide-react";
import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { setDiagnostics } from "@codemirror/lint";
import {
  sceneDirectiveInsertion,
  sceneIndexAtCursorLine,
  sceneTemplateInsertion,
} from "@/lib/editor/insert-scene-template";
import type { Scene } from "@markdown-video/core";
import {
  diagnosticsByLine,
  getDiagnostics,
  sortDiagnostics,
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
import { getMissingAssetDiagnostics } from "@/lib/assets/missing-assets";
import {
  ensureAssetLibraryLoaded,
  useAssetLibrary,
} from "@/lib/assets/asset-library";

export interface MarkdownEditorProps {
  /** Opens the searchable scene-snippet insertion palette. */
  onOpenInsertPalette?: () => void;
}

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
  /** Structurally insert a full scene snippet after the cursor/playback scene. */
  insertSceneTemplate: (template: string) => boolean;
  /** Insert a scene-scoped directive scaffold into the cursor/playback scene. */
  insertDirective: (directive: string) => boolean;

}

function sceneIndexAtTime(scenes: Scene[], currentTime: number): number {
  let accumulated = 0;
  for (let index = 0; index < scenes.length; index++) {
    const end = accumulated + scenes[index].duration;
    if (currentTime >= accumulated && currentTime < end) return index;
    accumulated = end;
  }
  return scenes.length > 0 ? scenes.length - 1 : -1;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
  { onOpenInsertPalette },
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
  const validationRunRef = useRef(0);

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

  const publishDiagnostics = useCallback(
    (nextDiagnostics: Diagnostic[]) => {
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
    [dispatchMarkers]
  );

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
        const validationRun = ++validationRunRef.current;
        const syntaxDiagnostics = getDiagnostics(text);
        publishDiagnostics(syntaxDiagnostics);

        // Asset existence is browser-host state (IndexedDB plus same-origin
        // static files), so it stays outside core syntax validation. Publish
        // parser diagnostics immediately, then layer in asynchronous media
        // warnings only if this is still the newest validation of the same
        // live document.
        void ensureAssetLibraryLoaded()
          .then(() =>
            getMissingAssetDiagnostics(text, {
              assets: useAssetLibrary.getState().assets,
            })
          )
          .then((assetDiagnostics) => {
            const liveView = viewRef.current;
            if (
              validationRun !== validationRunRef.current ||
              !liveView ||
              liveView.state.doc.toString() !== text
            ) {
              return;
            }
            publishDiagnostics(sortDiagnostics([...syntaxDiagnostics, ...assetDiagnostics]));
          })
          .catch((error) => {
            console.warn("[markdown-video] Asset validation failed:", error);
          });
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

    // Upload/delete changes asset existence without changing markdown. Force
    // one validation pass so warnings appear/disappear immediately.
    void ensureAssetLibraryLoaded();
    const unsubscribeAssetLibrary = useAssetLibrary.subscribe((state, previous) => {
      if (state.libraryRevision !== previous.libraryRevision) {
        syncRef.current?.validateNow();
      }
    });

    return () => {
      unsubscribeAssetLibrary();
      registerActiveEditorFlush(null);
      registerActiveEditorView(null);
      sync.destroy();
      view.destroy();
      viewRef.current = null;
      syncRef.current = null;
    };
  }, [dispatchMarkers, publishDiagnostics]);

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
      insertSceneTemplate: (template: string) => {
        const view = viewRef.current;
        if (!view) return false;

        // The insertion calculation must use the same text the store and
        // parser saw. Flush first so pending typing participates in scene
        // ranges, then verify there was no ordering race before dispatching.
        syncRef.current?.flushPending();
        const store = useVideoStore.getState();
        const liveText = view.state.doc.toString();
        if (liveText !== store.markdown) {
          console.warn("[markdown-video] Scene insertion skipped: editor and store markdown diverged");
          return false;
        }

        const ranges = store.scenes.map((scene) => scene.sourceMap?.scene);
        const cursorLine = liveText.slice(0, view.state.selection.main.head).split("\n").length;
        const cursorSceneIndex = sceneIndexAtCursorLine(ranges, cursorLine);
        const insertion = sceneTemplateInsertion(
          liveText,
          template,
          ranges,
          cursorSceneIndex >= 0 ? cursorSceneIndex : sceneIndexAtTime(store.scenes, store.currentTime)
        );
        const end = insertion.offset + insertion.text.length;
        view.dispatch({
          changes: { from: insertion.offset, insert: insertion.text },
          selection: EditorSelection.cursor(end),
          effects: EditorView.scrollIntoView(end, { y: "end" }),
        });
        // Palette insertion is a discrete authoring action, not typing: commit
        // it immediately so preview/properties update and undo captures exactly
        // this insertion as one history entry.
        syncRef.current?.flushPending();
        view.contentDOM.focus();
        return true;
      },
      insertDirective: (directive: string) => {
        const view = viewRef.current;
        if (!view) return false;

        syncRef.current?.flushPending();
        const store = useVideoStore.getState();
        const liveText = view.state.doc.toString();
        if (liveText !== store.markdown) {
          console.warn("[markdown-video] Directive insertion skipped: editor and store markdown diverged");
          return false;
        }

        const insertion = sceneDirectiveInsertion(
          liveText,
          directive,
          store.scenes.map((scene) => scene.sourceMap?.scene),
          sceneIndexAtTime(store.scenes, store.currentTime),
          view.state.selection.main.head
        );
        const end = insertion.offset + insertion.text.length;
        view.dispatch({
          changes: { from: insertion.offset, insert: insertion.text },
          selection: EditorSelection.cursor(end),
          effects: EditorView.scrollIntoView(end, { y: "end" }),
        });
        syncRef.current?.flushPending();
        view.contentDOM.focus();
        return true;
      },
    }),
    []
  );

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

      // Validation is debounced, so the panel entry being acted on can be
      // stale relative to the live document — applying it blindly would edit
      // the wrong text or no-op. Force synchronous validation, then apply
      // only when an equivalent diagnostic with the same fix is still
      // present for the current document. The recheck is strict about the
      // line number: the same message one line up or down is a different
      // edit site than the one the user clicked.
      syncRef.current?.validateNow();
      const current = getDiagnostics(view.state.doc.toString());
      const match = current.find(
        (candidate) =>
          candidate.line === d.line &&
          candidate.severity === d.severity &&
          candidate.message === d.message &&
          candidate.fix?.find === d.fix?.find &&
          candidate.fix?.replace === d.fix?.replace
      );
      if (!match) {
        // validateNow() already refreshed the panel and lint ranges, so the
        // stale entry disappears instead of the button silently no-oping.
        return;
      }

      const change = diagnosticFixChange(view.state.doc, match);
      if (change) {
        view.dispatch({
          changes: { from: change.from, to: change.to, insert: change.insert },
        });
      }
      if (match.line) {
        selectLine(match.line);
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

      {/* Scene insertion entry point */}
      <div className="p-2 border-b border-gray-200 dark:border-neutral-800 shrink-0 bg-gray-50/50 dark:bg-neutral-900/50">
        <button
          type="button"
          onClick={onOpenInsertPalette}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-pink-200 bg-white px-3 py-2 text-sm font-medium text-pink-600 shadow-sm transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 dark:border-pink-900/60 dark:bg-neutral-950 dark:text-pink-400 dark:hover:bg-pink-950/25"
        >
          <Plus className="h-4 w-4" />
          Insert scene or directive
          <kbd className="ml-auto whitespace-nowrap rounded border border-pink-200 bg-pink-50 px-1.5 py-0.5 text-[10px] dark:border-pink-900/60 dark:bg-pink-950/25">
            ⌘/Ctrl I
          </kbd>
        </button>
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
