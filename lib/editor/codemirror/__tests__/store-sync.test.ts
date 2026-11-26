// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorStoreSync, ExternalChange, isExternalChange } from "../store-sync";
import { useVideoStore } from "@/lib/use-video-store";

const INITIAL = "!scene\n!text\nHello";

function resetStore(markdown = INITIAL) {
  useVideoStore.getState().setMarkdown(markdown, false);
  useVideoStore.setState({ history: { past: [], future: [] } });
}

function typeText(view: EditorView, insert: string, from = view.state.doc.length) {
  view.dispatch({
    changes: { from, insert },
    annotations: Transaction.userEvent.of("input.type"),
  });
}

describe("EditorStoreSync", () => {
  let view: EditorView;
  let sync: EditorStoreSync | null;
  let parent: HTMLDivElement;
  let validated: string[];
  let userEdits: number;

  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
    validated = [];
    userEdits = 0;
    parent = document.createElement("div");
    document.body.appendChild(parent);
    view = new EditorView({
      state: EditorState.create({
        doc: useVideoStore.getState().markdown,
        // Wired exactly like the component: every update flows to the bridge.
        // The closure reads the variable so the bridge can be constructed
        // after the view.
        extensions: [
          EditorView.updateListener.of((u) => sync?.handleUpdate(u)),
        ],
      }),
      parent,
    });
    sync = new EditorStoreSync({
      view,
      onValidate: (text) => validated.push(text),
      onUserEdit: () => userEdits++,
    });
  });

  afterEach(() => {
    sync?.destroy();
    view.destroy();
    parent.remove();
    vi.useRealTimers();
  });

  it("isExternalChange detects annotated transactions", () => {
    const state = EditorState.create({ doc: "abc" });
    const external = state.update({
      changes: { from: 0, insert: "x" },
      annotations: ExternalChange.of("store"),
    });
    expect(isExternalChange(external)).toBe(true);
    const userTr = state.update({ changes: { from: 0, insert: "x" } });
    expect(isExternalChange(userTr)).toBe(false);
  });

  describe("with an update listener forwarding to the bridge", () => {
    it("commits typed text to the store after the debounce", () => {
      typeText(view, " world");
      expect(useVideoStore.getState().markdown).toBe(INITIAL);
      vi.advanceTimersByTime(500);
      expect(useVideoStore.getState().markdown).toBe(INITIAL + " world");
    });

    it("does not commit before the debounce elapses", () => {
      typeText(view, " world");
      vi.advanceTimersByTime(499);
      expect(useVideoStore.getState().markdown).toBe(INITIAL);
    });

    it("commits once for a burst of typing", () => {
      typeText(view, "a");
      vi.advanceTimersByTime(200);
      typeText(view, "b");
      vi.advanceTimersByTime(200);
      typeText(view, "c");
      vi.advanceTimersByTime(500);
      expect(useVideoStore.getState().markdown).toBe(INITIAL + "abc");
      // One history entry per debounced commit, not one per keystroke.
      expect(useVideoStore.getState().history.past).toHaveLength(1);
    });

    it("flushPending commits immediately", () => {
      typeText(view, " now");
      sync!.flushPending();
      expect(useVideoStore.getState().markdown).toBe(INITIAL + " now");
    });

    it("flushPending is a no-op when the store already matches", () => {
      typeText(view, " now");
      sync!.flushPending();
      const pastLength = useVideoStore.getState().history.past.length;
      sync!.flushPending();
      expect(useVideoStore.getState().history.past.length).toBe(pastLength);
    });

    it("applies external store mutations to the document", () => {
      useVideoStore.getState().setMarkdown("completely different");
      expect(view.state.doc.toString()).toBe("completely different");
    });

    it("does not re-commit echoed external text", () => {
      typeText(view, " typed");
      sync!.flushPending();
      useVideoStore.getState().setMarkdown("external");
      vi.advanceTimersByTime(1000);
      // If the echo were re-committed, an extra history entry would appear.
      const past = useVideoStore.getState().history.past;
      expect(past.filter((entry) => entry === "external")).toHaveLength(0);
    });

    it("keeps the redo future intact after an undo echo", () => {
      typeText(view, " v2");
      sync!.flushPending();
      useVideoStore.getState().undo();
      expect(view.state.doc.toString()).toBe(INITIAL);
      expect(useVideoStore.getState().canRedo()).toBe(true);
      vi.advanceTimersByTime(1500);
      // No commit may have fired: the future must survive.
      expect(useVideoStore.getState().canRedo()).toBe(true);
      useVideoStore.getState().redo();
      expect(view.state.doc.toString()).toBe(INITIAL + " v2");
    });

    it("typing after undo clears the redo future on commit", () => {
      typeText(view, " v2");
      sync!.flushPending();
      useVideoStore.getState().undo();
      typeText(view, " different");
      vi.advanceTimersByTime(500);
      expect(useVideoStore.getState().canRedo()).toBe(false);
    });

    it("does not echo back the editor's own commits", () => {
      typeText(view, " abc");
      const docBefore = view.state.doc.toString();
      const selectionBefore = view.state.selection.main.head;
      vi.advanceTimersByTime(500);
      expect(useVideoStore.getState().markdown).toBe(docBefore);
      // The document object must be untouched by the commit (no echo replace).
      expect(view.state.selection.main.head).toBe(selectionBefore);
      expect(view.state.doc.toString()).toBe(docBefore);
    });

    it("runs validation shortly after typing stops", () => {
      typeText(view, "x");
      expect(validated).toHaveLength(0);
      vi.advanceTimersByTime(300);
      expect(validated).toEqual([INITIAL + "x"]);
    });

    it("revalidates after external replacements too", () => {
      useVideoStore.getState().setMarkdown("external text");
      vi.advanceTimersByTime(300);
      expect(validated).toContain("external text");
    });

    it("notifies user edits only for non-external changes", () => {
      expect(userEdits).toBe(0);
      typeText(view, "x");
      expect(userEdits).toBe(1);
      useVideoStore.getState().setMarkdown("external");
      expect(userEdits).toBe(1);
    });

    it("tags editor commits with the editor origin and bumps the revision", () => {
      const revisionBefore = useVideoStore.getState().markdownRevision;
      typeText(view, " tagged");
      sync!.flushPending();
      expect(useVideoStore.getState().markdownOrigin).toBe("editor");
      expect(useVideoStore.getState().markdownRevision).toBe(revisionBefore + 1);
    });

    it("treats selection-only updates as neither edits nor validation triggers", () => {
      view.dispatch({ selection: { anchor: 0 } });
      vi.advanceTimersByTime(1000);
      expect(userEdits).toBe(0);
      expect(validated).toHaveLength(0);
    });
  });
});
