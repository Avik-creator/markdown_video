import { Annotation, type Transaction } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import { tagNextMarkdownOrigin, useVideoStore } from "@/lib/use-video-store";

/**
 * Marks transactions that come from outside the editor (store echoes of
 * undo/redo, project opens, find/replace writes). The bridge never re-commits
 * externally-applied text back to the store, which is what keeps the redo
 * future alive after an undo echo.
 */
export const ExternalChange = Annotation.define<string>();

export function isExternalChange(tr: Transaction): boolean {
  return tr.annotation(ExternalChange) !== undefined;
}

const COMMIT_DELAY = 500; // ms after the last keystroke before the store commit
const VALIDATE_DELAY = 300; // ms after the last change before re-validating

export interface EditorStoreSyncOptions {
  view: EditorView;
  commitDelay?: number;
  validateDelay?: number;
  /** Runs once typing (or an external replacement) pauses, with the live text. */
  onValidate?: (text: string) => void;
  /** Runs synchronously for every user-originated document change. */
  onUserEdit?: () => void;
}

/**
 * Two-way bridge between the CodeMirror document and the Zustand store.
 *
 * The editor is the live document. Typing is committed to the store after a
 * debounce; the store stays authoritative for undo/redo. Store mutations are
 * echoed into the editor synchronously inside zustand's subscriber callback,
 * so event ordering can never interleave a stale echo with fresh typing:
 * whichever event (keystroke or store mutation) is processed first is fully
 * applied before the next one starts.
 *
 * Echoes compare document text, so the editor's own commits are no-ops, and
 * echoed replacements carry {@link ExternalChange} so they are never
 * committed back (which would duplicate history entries and clear the redo
 * future — the bug this design replaces).
 */
export class EditorStoreSync {
  private readonly view: EditorView;
  private readonly commitDelay: number;
  private readonly validateDelay: number;
  // Mutable so React can rebind callbacks without recreating the editor.
  onValidate: ((text: string) => void) | undefined;
  onUserEdit: (() => void) | undefined;

  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private validateTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly unsubscribe: () => void;
  private destroyed = false;

  constructor(options: EditorStoreSyncOptions) {
    this.view = options.view;
    this.commitDelay = options.commitDelay ?? COMMIT_DELAY;
    this.validateDelay = options.validateDelay ?? VALIDATE_DELAY;
    this.onValidate = options.onValidate;
    this.onUserEdit = options.onUserEdit;

    this.unsubscribe = useVideoStore.subscribe((state, previous) => {
      if (this.destroyed) return;
      // Playback ticks and unrelated state hit this subscriber constantly;
      // bail before touching the document unless the text actually changed.
      if (state.markdown === previous.markdown) return;
      this.applyStoreEcho(state.markdown, state.markdownOrigin);
    });
  }

  /** Forwarded from the editor's update listener. */
  handleUpdate(update: ViewUpdate) {
    if (this.destroyed || !update.docChanged) return;

    const userChanged = update.transactions.some(
      (tr) => tr.docChanged && !isExternalChange(tr)
    );

    if (userChanged) {
      this.onUserEdit?.();
      this.scheduleCommit();
    }
    // Diagnostics reflect the document regardless of who changed it, so both
    // user edits and external replacements restart the validation timer.
    this.scheduleValidation();
  }

  /** Commit any uncommitted editor text to the store right now. */
  flushPending(): boolean {
    this.cancelCommit();
    const text = this.view.state.doc.toString();
    const store = useVideoStore.getState();
    if (text === store.markdown) return false;
    tagNextMarkdownOrigin("editor");
    store.setMarkdown(text);
    return true;
  }

  /** Run the validation callback immediately with the live document text. */
  validateNow() {
    this.cancelValidation();
    this.onValidate?.(this.view.state.doc.toString());
  }

  destroy() {
    this.destroyed = true;
    this.cancelCommit();
    this.cancelValidation();
    this.unsubscribe();
  }

  private applyStoreEcho(markdown: string, origin: string | null) {
    const doc = this.view.state.doc;
    const current = doc.toString();
    if (current === markdown) return;
    this.view.dispatch({
      changes: { from: 0, to: doc.length, insert: markdown },
      annotations: ExternalChange.of(origin ?? "store"),
    });
  }

  private scheduleCommit() {
    this.cancelCommit();
    this.commitTimer = setTimeout(() => {
      this.commitTimer = null;
      this.flushPending();
    }, this.commitDelay);
  }

  private cancelCommit() {
    if (this.commitTimer !== null) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
  }

  private scheduleValidation() {
    this.cancelValidation();
    this.validateTimer = setTimeout(() => {
      this.validateTimer = null;
      this.onValidate?.(this.view.state.doc.toString());
    }, this.validateDelay);
  }

  private cancelValidation() {
    if (this.validateTimer !== null) {
      clearTimeout(this.validateTimer);
      this.validateTimer = null;
    }
  }
}

// Cross-component flush seam. Flows that read or rewrite the store markdown
// outside the editor's own files (share/export modals, timeline mutations,
// the project menu) cannot reach the editor's React ref, but they can call
// flushPendingEditorText() first so they never operate on stale text. The
// editor registers itself while mounted; the call is a safe no-op otherwise.
let activeFlush: (() => boolean) | null = null;
let activeView: EditorView | null = null;

export function registerActiveEditorFlush(flush: (() => boolean) | null): void {
  activeFlush = flush;
}

/** Commit uncommitted editor typing to the store, wherever the caller lives. */
export function flushPendingEditorText(): void {
  activeFlush?.();
}

/**
 * Integration/testing seam exposing the mounted editor view. Registered
 * alongside the flush callback so tests and future cross-component
 * integrations can drive the editor without the React ref.
 */
export function registerActiveEditorView(view: EditorView | null): void {
  activeView = view;
}

export function getActiveEditorView(): EditorView | null {
  return activeView;
}
