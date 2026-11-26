// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { EditorState, Transaction } from "@codemirror/state";
import {
  EditorStoreSync,
  ExternalChange,
  isExternalChange,
  minimalEditRange,
} from "../store-sync";
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

    it("keeps the cursor in place when an undo echo edits far away from it", () => {
      // Edit the tail of the document while the caret sits near the top.
      const caretPos = 3;
      view.dispatch({ selection: { anchor: caretPos } });
      typeText(view, " v2");
      sync!.flushPending();
      expect(useVideoStore.getState().markdown).toBe(INITIAL + " v2");

      useVideoStore.getState().undo();
      expect(view.state.doc.toString()).toBe(INITIAL);
      // A whole-document replacement overlaps every position and collapses
      // the caret; the minimal infix deletion is far away, so it survives.
      expect(view.state.selection.main.head).toBe(caretPos);

      useVideoStore.getState().redo();
      expect(view.state.doc.toString()).toBe(INITIAL + " v2");
      expect(view.state.selection.main.head).toBe(caretPos);
    });

    it("keeps a tail caret at the end when the echo inserts at the start", () => {
      // Caret at the very end of the document; an external mutation inserts
      // text at the very beginning. The caret must ride the mapping forward
      // and stay at the end of the document instead of collapsing.
      const endPos = view.state.doc.length;
      view.dispatch({ selection: { anchor: endPos } });

      const prefix = "!scene\n!text\nInserted\n\n---\n\n";
      useVideoStore.getState().setMarkdown(prefix + INITIAL);
      expect(view.state.doc.toString()).toBe(prefix + INITIAL);
      expect(view.state.selection.main.head).toBe(endPos + prefix.length);
    });

    it("keeps the caret when the echo deletes ahead of it", () => {
      const original = useVideoStore.getState().markdown;
      const prefix = "prefix line\n";
      useVideoStore.getState().setMarkdown(prefix + original, false);
      // The echo above inserted at the start; put the caret back at the end.
      const endPos = view.state.doc.length;
      view.dispatch({ selection: { anchor: endPos } });

      useVideoStore.getState().setMarkdown(original, false);
      expect(view.state.doc.toString()).toBe(original);
      expect(view.state.selection.main.head).toBe(endPos - prefix.length);
    });

    it("skips the echo dispatch entirely when the document already matches", () => {
      // The editor's own commit changes the store markdown, so the subscriber
      // fires synchronously — but the document already holds this exact text
      // and not a single echo dispatch may happen.
      typeText(view, " abc");
      const dispatchSpy = vi.spyOn(view, "dispatch");
      sync!.flushPending();
      expect(useVideoStore.getState().markdown).toBe(INITIAL + " abc");
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it("dispatches nothing when the store markdown did not actually change", () => {
      const dispatchSpy = vi.spyOn(view, "dispatch");
      useVideoStore.getState().setMarkdown(INITIAL, false);
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it("echoes reordered documents as a localized infix, not a full replace", () => {
      // Simulate a timeline reorder: two scenes swap places. The caret inside
      // the unchanged prefix must not move at all.
      const twoScenes = INITIAL + "\n\n---\n\n!scene\n!text\nWorld";
      useVideoStore.getState().setMarkdown(twoScenes, false);
      view.dispatch({ selection: { anchor: 2 } });

      const reordered = "!scene\n!text\nWorld\n\n---\n\n" + INITIAL;
      useVideoStore.getState().setMarkdown(reordered, false);
      expect(view.state.doc.toString()).toBe(reordered);
      expect(view.state.selection.main.head).toBe(2);
    });
  });
});

describe("minimalEditRange", () => {
  function applyEdit(current: string, edit: { from: number; to: number; insert: string }) {
    return current.slice(0, edit.from) + edit.insert + current.slice(edit.to);
  }

  it("returns null for identical strings", () => {
    expect(minimalEditRange("abc", "abc")).toBeNull();
    expect(minimalEditRange("", "")).toBeNull();
  });

  it("covers an insertion at the end", () => {
    expect(minimalEditRange("abc", "abcdef")).toEqual({
      from: 3,
      to: 3,
      insert: "def",
    });
  });

  it("covers an insertion at the start", () => {
    expect(minimalEditRange("abc", "xyzabc")).toEqual({
      from: 0,
      to: 0,
      insert: "xyz",
    });
  });

  it("covers a deletion at the end", () => {
    expect(minimalEditRange("abcdef", "abc")).toEqual({
      from: 3,
      to: 6,
      insert: "",
    });
  });

  it("covers a deletion at the start", () => {
    expect(minimalEditRange("xyzabc", "abc")).toEqual({
      from: 0,
      to: 3,
      insert: "",
    });
  });

  it("covers a mid-document replacement", () => {
    expect(minimalEditRange("abcXYZdef", "abc123def")).toEqual({
      from: 3,
      to: 6,
      insert: "123",
    });
  });

  it("falls back to a full replacement for completely different documents", () => {
    expect(minimalEditRange("abc", "xyz")).toEqual({
      from: 0,
      to: 3,
      insert: "xyz",
    });
  });

  it("handles insertion into an empty document", () => {
    expect(minimalEditRange("", "abc")).toEqual({ from: 0, to: 0, insert: "abc" });
  });

  it("handles deletion of the whole document", () => {
    expect(minimalEditRange("abc", "")).toEqual({ from: 0, to: 3, insert: "" });
  });

  it("does not double-count overlapping repeated characters", () => {
    // Naive prefix+suffix scans would keep more characters than the shorter
    // document has. "aa" -> "aaa" must be a single-character insertion.
    const edit = minimalEditRange("aa", "aaa");
    expect(edit).toEqual({ from: 2, to: 2, insert: "a" });
  });

  it("handles one string being a strict infix of the other", () => {
    expect(minimalEditRange("aXb", "aXYZb")).toEqual({
      from: 2,
      to: 2,
      insert: "YZ",
    });
  });

  it.each([
    ["", ""],
    ["", "abc"],
    ["abc", ""],
    ["abc", "abc"],
    ["abc", "abcdef"],
    ["xyzabc", "abc"],
    ["aa", "aaa"],
    ["aaa", "aa"],
    ["aab", "ab"],
    ["ab", "aab"],
    ["abcXYZdef", "abc123def"],
    ["completely different", "nothing alike at all"],
    ["!scene\n!text\nHello", "!scene\n!text\nHello world"],
    ["abab", "ababab"],
  ])("applying the edit to %j always yields %j", (current, next) => {
    const edit = minimalEditRange(current, next);
    if (edit === null) {
      expect(current).toBe(next);
      return;
    }
    expect(applyEdit(current, edit)).toBe(next);
    // The reported range must stay inside the current document.
    expect(edit.from).toBeGreaterThanOrEqual(0);
    expect(edit.to).toBeGreaterThanOrEqual(edit.from);
    expect(edit.to).toBeLessThanOrEqual(current.length);
  });
});
