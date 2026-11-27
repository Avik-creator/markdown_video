// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { applyDirectiveEditInEditor } from "../apply-directive-edit";
import {
  EditorStoreSync,
  registerActiveEditorFlush,
} from "../codemirror/store-sync";
import { useVideoStore } from "@/lib/use-video-store";

const INITIAL = "!scene\n!text\nHello\n!duration 3s";

function resetStore(markdown = INITIAL) {
  useVideoStore.getState().setMarkdown(markdown, false);
  useVideoStore.setState({
    history: { past: [], future: [] },
    highlightRange: null,
  });
}

describe("store directive edits", () => {
  beforeEach(() => resetStore());

  it("commits a successful rewrite synchronously and makes it undoable", () => {
    const before = useVideoStore.getState().markdown;
    const result = useVideoStore.getState().applyDirectiveEdit({
      sceneIndex: 0,
      directive: "duration",
      valueName: "seconds",
      value: 6,
    });

    expect(result).toMatchObject({ ok: true, action: "updated" });
    expect(useVideoStore.getState().markdown).toContain("!duration 6s");
    expect(useVideoStore.getState().scenes[0].duration).toBe(6);
    expect(useVideoStore.getState().history.past).toEqual([before]);

    useVideoStore.getState().undo();
    expect(useVideoStore.getState().markdown).toBe(before);
    expect(useVideoStore.getState().scenes[0].duration).toBe(3);
  });

  it("does not touch markdown or history when the rewrite engine rejects input", () => {
    const before = useVideoStore.getState().markdown;
    const historyBefore = useVideoStore.getState().history.past.length;
    const result = useVideoStore.getState().applyDirectiveEdit({
      sceneIndex: 0,
      directive: "duration",
      valueName: "seconds",
      value: 0,
    });

    expect(result.ok).toBe(false);
    expect(useVideoStore.getState().markdown).toBe(before);
    expect(useVideoStore.getState().history.past).toHaveLength(historyBefore);
  });
});

describe("editor-facing directive edits", () => {
  let view: EditorView | null;
  let sync: EditorStoreSync | null;
  let parent: HTMLDivElement | null;

  beforeEach(() => {
    resetStore();
    parent = document.createElement("div");
    document.body.appendChild(parent);
    view = new EditorView({
      state: EditorState.create({ doc: useVideoStore.getState().markdown }),
      parent,
    });
    sync = new EditorStoreSync({ view });
    registerActiveEditorFlush(() => sync?.flushPending() ?? false);
  });

  afterEach(() => {
    registerActiveEditorFlush(null);
    sync?.destroy();
    view?.destroy();
    parent?.remove();
    view = null;
    sync = null;
    parent = null;
    vi.restoreAllMocks();
  });

  it("flushes uncommitted typing before computing the rewrite", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    view!.dispatch({
      changes: { from: view!.state.doc.length, insert: "\n!background #111111" },
    });
    expect(useVideoStore.getState().markdown).toBe(INITIAL);

    const result = applyDirectiveEditInEditor({
      sceneIndex: 0,
      directive: "duration",
      valueName: "seconds",
      value: 6,
    });

    expect(result.ok).toBe(true);
    const markdown = useVideoStore.getState().markdown;
    expect(markdown).toContain("!duration 6s");
    expect(markdown).toContain("!background #111111");
    expect(warn).not.toHaveBeenCalled();
  });

  it("maps the editor caret through an inserted directive instead of jumping to the top", () => {
    resetStore("!scene\n!text\nHello");
    view!.dispatch({
      changes: { from: 0, to: view!.state.doc.length, insert: useVideoStore.getState().markdown },
    });
    const end = view!.state.doc.length;
    view!.dispatch({ selection: { anchor: end } });

    const result = applyDirectiveEditInEditor({
      sceneIndex: 0,
      directive: "duration",
      valueName: "seconds",
      value: 5,
    });

    expect(result).toMatchObject({ ok: true, action: "inserted" });
    const insertedLength = "!duration 5s\n".length;
    expect(view!.state.selection.main.head).toBe(end + insertedLength);
  });

  it("warns and leaves the document alone when a panel value is invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const before = useVideoStore.getState().markdown;

    const result = applyDirectiveEditInEditor({
      sceneIndex: 0,
      directive: "transition",
      valueName: "type",
      value: "not-a-transition",
    });

    expect(result.ok).toBe(false);
    expect(useVideoStore.getState().markdown).toBe(before);
    expect(warn).toHaveBeenCalledOnce();
  });
});
