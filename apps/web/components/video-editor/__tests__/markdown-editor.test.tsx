// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { Transaction } from "@codemirror/state";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "../markdown-editor";
import { useVideoStore } from "@/lib/use-video-store";
import {
  flushPendingEditorText,
  getActiveEditorView,
} from "@/lib/editor/codemirror/store-sync";
import type { EditorView } from "@codemirror/view";

const INITIAL = "!scene\n!text\nHello\n!duration 3s";

function resetStore(markdown = INITIAL) {
  useVideoStore.getState().setMarkdown(markdown, false);
  useVideoStore.setState({
    history: { past: [], future: [] },
    highlightRange: null,
    findText: "",
    replaceText: "",
  });
}

function view(): EditorView {
  const v = getActiveEditorView();
  if (!v) throw new Error("editor view not registered");
  return v;
}

/** Simulate user typing: a text input transaction carrying CM's user event. */
function type(insert: string, from = view().state.doc.length) {
  act(() => {
    view().dispatch({
      changes: { from, insert },
      selection: { anchor: from + insert.length },
      annotations: Transaction.userEvent.of("input.type"),
    });
  });
}

/** Simulate backspace over the selection or the character before the caret. */
function backspace() {
  const range = view().state.selection.main;
  const from = range.empty ? Math.max(0, range.head - 1) : range.from;
  act(() => {
    view().dispatch({
      changes: { from, to: range.empty ? range.head : range.to },
      selection: { anchor: from },
      annotations: Transaction.userEvent.of("delete.backward"),
    });
  });
}

function keydown(
  key: string,
  mods: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}
) {
  act(() => {
    view().contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...mods,
      })
    );
  });
}

function completionTooltip(): Element | null {
  return document.querySelector(".cm-tooltip-autocomplete");
}

async function waitForCompletion(): Promise<Element> {
  let tooltip: Element | null = null;
  await waitFor(
    () => {
      tooltip = completionTooltip();
      expect(tooltip).not.toBeNull();
    },
    { timeout: 1500 }
  );
  return tooltip!;
}

async function waitForNoCompletion() {
  await waitFor(
    () => expect(completionTooltip()).toBeNull(),
    { timeout: 1500 }
  );
}

describe("MarkdownEditor (CodeMirror)", () => {
  let ref: React.RefObject<MarkdownEditorHandle | null>;

  beforeEach(() => {
    resetStore();
    ref = createRef<MarkdownEditorHandle>();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the store markdown into an editable CM document", () => {
    render(<MarkdownEditor ref={ref} />);
    expect(view().state.doc.toString()).toBe(INITIAL);
    const content = document.querySelector(".cm-content");
    expect(content).not.toBeNull();
    expect(content!.getAttribute("contenteditable")).toBe("true");
    expect(content!.getAttribute("aria-label")).toBe("Scene markdown");
    expect(content!.getAttribute("spellcheck")).toBe("false");
  });

  it("shows the line count in the header", () => {
    render(<MarkdownEditor ref={ref} />);
    expect(document.body.textContent).toContain(`${INITIAL.split("\n").length} lines`);
  });

  it("renders line numbers", () => {
    render(<MarkdownEditor ref={ref} />);
    const numbers = [...document.querySelectorAll(".cm-lineNumbers .cm-gutterElement")].map(
      (el) => el.textContent
    );
    // CM renders an extra hidden sizing element (a width-estimate digit) in
    // front of the real line numbers.
    expect(numbers.slice(-4)).toEqual(["1", "2", "3", "4"]);
  });

  it("uses a tab size of 2", () => {
    render(<MarkdownEditor ref={ref} />);
    expect(view().state.tabSize).toBe(2);
  });

  it("commits typing to the store after the debounce", async () => {
    render(<MarkdownEditor ref={ref} />);
    type("!");
    expect(useVideoStore.getState().markdown).toBe(INITIAL);
    await waitFor(
      () => expect(useVideoStore.getState().markdown).toBe(INITIAL + "!"),
      { timeout: 1500 }
    );
  });

  it("keeps CM native history disabled: undo/redo stay store-authoritative", async () => {
    render(<MarkdownEditor ref={ref} />);
    type(" more");
    ref.current!.flushPending();
    expect(useVideoStore.getState().markdown).toBe(INITIAL + " more");

    act(() => useVideoStore.getState().undo());
    expect(view().state.doc.toString()).toBe(INITIAL);
    act(() => useVideoStore.getState().redo());
    expect(view().state.doc.toString()).toBe(INITIAL + " more");
  });

  it("echoes external store mutations into the document", () => {
    render(<MarkdownEditor ref={ref} />);
    act(() => useVideoStore.getState().setMarkdown("replacement document"));
    expect(view().state.doc.toString()).toBe("replacement document");
  });

  describe("completion", () => {
    it("opens directive completions while typing", async () => {
      render(<MarkdownEditor ref={ref} />);
      type("\n!sc");
      const tooltip = await waitForCompletion();
      expect(tooltip.textContent).toContain("scene");
    });

    it("accepts the active completion with Enter", async () => {
      render(<MarkdownEditor ref={ref} />);
      type("\n!sc");
      await waitForCompletion();
      keydown("Enter");
      expect(view().state.doc.toString()).toContain("!scene");
    });

    it("accepts the active completion with Tab", async () => {
      render(<MarkdownEditor ref={ref} />);
      type("\n!sc");
      await waitForCompletion();
      keydown("Tab");
      expect(view().state.doc.toString()).toContain("!scene");
    });

    it("does not insert anything for Tab when no completion is open", async () => {
      render(<MarkdownEditor ref={ref} />);
      await waitForNoCompletion();
      const before = view().state.doc.toString();
      keydown("Tab");
      expect(view().state.doc.toString()).toBe(before);
    });

    it("closes the popup with Escape without touching the document", async () => {
      render(<MarkdownEditor ref={ref} />);
      type("\n!sc");
      await waitForCompletion();
      keydown("Escape");
      await waitForNoCompletion();
      expect(view().state.doc.toString()).toBe(INITIAL + "\n!sc");
    });

    it("chains property-name completion into value completion", async () => {
      render(<MarkdownEditor ref={ref} />);
      type("\n!chart ty");
      const tooltip = await waitForCompletion();
      expect(tooltip.textContent).toContain("type:");

      keydown("Enter");
      expect(view().state.doc.toString()).toContain("!chart type:");

      // The chain: accepting "type:" re-opens with the chart type values.
      let values: Element | null = null;
      await waitFor(() => {
        values = completionTooltip();
        expect(values).not.toBeNull();
        expect(values!.textContent).toContain("bar");
      });
    });

    it("keeps chaining through deletions within the completed value", async () => {
      render(<MarkdownEditor ref={ref} />);
      type("\n!chart type:ba");
      const values = await waitForCompletion();
      expect(values.textContent).toContain("bar");

      // Deleting part of the value re-queries rather than closing, so the
      // popup keeps offering the remaining matches.
      backspace();
      await waitFor(() => {
        const tooltip = completionTooltip();
        expect(tooltip).not.toBeNull();
        expect(tooltip!.textContent).toContain("bar");
      });
    });

    it("offers completions after a multi-character paste-style insert", async () => {
      render(<MarkdownEditor ref={ref} />);
      // A paste arrives as one input transaction rather than keystrokes.
      type("\n!chart type:");
      const tooltip = await waitForCompletion();
      expect(tooltip.textContent).toContain("bar");
    });
  });

  describe("comment toggling", () => {
    it("comments the current line with Ctrl+/", async () => {
      render(<MarkdownEditor ref={ref} />);
      // Caret in the middle of the second line.
      const pos = INITIAL.indexOf("!text") + 2;
      act(() => {
        view().dispatch({ selection: { anchor: pos } });
      });
      keydown("/", { ctrlKey: true });
      expect(view().state.doc.toString()).toBe(
        INITIAL.replace("!text", "// !text")
      );
    });

    it("uncomments with a second Ctrl+/", () => {
      render(<MarkdownEditor ref={ref} />);
      const pos = INITIAL.indexOf("!text") + 2;
      act(() => {
        view().dispatch({ selection: { anchor: pos } });
      });
      keydown("/", { ctrlKey: true });
      keydown("/", { ctrlKey: true });
      expect(view().state.doc.toString()).toBe(INITIAL);
    });
  });

  describe("highlight range", () => {
    it("decorates the highlighted lines and shows the header chip", async () => {
      render(<MarkdownEditor ref={ref} />);
      act(() => {
        useVideoStore.getState().setHighlightRange({ startLine: 2, endLine: 3 });
      });
      await waitFor(() => {
        expect(document.querySelectorAll(".cm-md-highlight-line").length).toBe(2);
      });
      expect(document.body.textContent).toContain("Line 2-3");
    });

    it("clears the highlight when the user types", async () => {
      render(<MarkdownEditor ref={ref} />);
      act(() => {
        useVideoStore.getState().setHighlightRange({ startLine: 1, endLine: 2 });
      });
      await waitFor(() => {
        expect(document.querySelectorAll(".cm-md-highlight-line").length).toBe(2);
      });
      type("x");
      expect(useVideoStore.getState().highlightRange).toBeNull();
      await waitFor(() => {
        expect(document.querySelectorAll(".cm-md-highlight-line").length).toBe(0);
      });
    });

    it("clears the highlight when the editor is clicked", async () => {
      render(<MarkdownEditor ref={ref} />);
      act(() => {
        useVideoStore.getState().setHighlightRange({ startLine: 1, endLine: 1 });
      });
      await waitFor(() => {
        expect(document.querySelectorAll(".cm-md-highlight-line").length).toBe(1);
      });
      act(() => {
        view().contentDOM.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, cancelable: true })
        );
      });
      expect(useVideoStore.getState().highlightRange).toBeNull();
    });
  });

  describe("diagnostics", () => {
    it("shows the problems panel for invalid initial content", () => {
      resetStore("!scene\n!duraton 3s");
      render(<MarkdownEditor ref={ref} />);
      expect(document.body.textContent).toContain('Unknown directive "!duraton"');
      expect(document.body.textContent).toMatch(/1 error/);
    });

    it("lints the document after typing pauses", async () => {
      render(<MarkdownEditor ref={ref} />);
      // No problems in the initial valid document.
      expect(document.body.textContent).not.toMatch(/\d error/);
      type("\n!duraton 3s");
      await waitFor(
        () => expect(document.body.textContent).toContain('Unknown directive "!duraton"'),
        { timeout: 1500 }
      );
    });

    it("applies a fix through the panel Fix button", async () => {
      resetStore("!scene\n!duraton 3s");
      render(<MarkdownEditor ref={ref} />);
      const fixButton = [...document.querySelectorAll("button")].find(
        (b) => b.textContent === "Fix"
      );
      expect(fixButton).toBeDefined();
      act(() => fixButton!.click());
      expect(view().state.doc.toString()).toBe("!scene\n!duration 3s");
    });

    it("still applies the fix when unrelated typing has not changed the diagnostic", () => {
      resetStore("!scene\n!duraton 3s");
      render(<MarkdownEditor ref={ref} />);
      // Type within the validation debounce window: the panel entry is
      // unrefreshed but the underlying diagnostic is unchanged, so the
      // recheck finds an equivalent diagnostic and the fix applies.
      type("\nnotes");

      const fixButton = [...document.querySelectorAll("button")].find(
        (b) => b.textContent === "Fix"
      );
      expect(fixButton).toBeDefined();
      act(() => fixButton!.click());
      expect(view().state.doc.toString()).toBe("!scene\n!duration 3s\nnotes");
    });

    it("does not apply a stale fix when typing has invalidated the diagnostic", () => {
      resetStore("!scene\n!duraton 3s");
      render(<MarkdownEditor ref={ref} />);
      // Within the debounce window, prefix line 2 so it no longer parses as a
      // directive line. The stale panel entry still offers the line-2 fix,
      // whose find string "!duraton" is still present — applying it blindly
      // would corrupt the line into "x!duration 3s".
      type("x", "!scene\n".length);

      const fixButton = [...document.querySelectorAll("button")].find(
        (b) => b.textContent === "Fix"
      );
      expect(fixButton).toBeDefined();
      act(() => fixButton!.click());

      expect(view().state.doc.toString()).toBe("!scene\nx!duraton 3s");
      // The forced revalidation refreshes the panel synchronously, so the
      // stale entry disappears instead of the click being a silent no-op.
      expect(document.body.textContent).not.toContain("Unknown directive");
    });

    it("keeps document-level diagnostics in the panel but out of the lint ranges", () => {
      // A document with no scene directive produces a document-level problem.
      resetStore("!text\norphan without scene");
      render(<MarkdownEditor ref={ref} />);
      expect(document.body.textContent).toContain("No scenes found");
      // Document-level diagnostics have no line, so nothing is underlined.
      expect(document.querySelectorAll(".cm-lintRange").length).toBe(0);
    });

    it("underlines line-based diagnostics in the document", async () => {
      resetStore("!scene\n!duraton 3s");
      render(<MarkdownEditor ref={ref} />);
      await waitFor(() => {
        expect(
          document.querySelectorAll(".cm-lintRange-error, [class*='cm-lintRange']").length
        ).toBeGreaterThan(0);
      });
    });
  });

  describe("scene insertion", () => {
    it("exposes a single palette entry point instead of snippet-specific buttons", () => {
      const openPalette = vi.fn();
      render(<MarkdownEditor ref={ref} onOpenInsertPalette={openPalette} />);
      const button = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim().startsWith("Insert")
      );
      expect(button).toBeDefined();
      act(() => button!.click());
      expect(openPalette).toHaveBeenCalledOnce();
    });

    it("insertSceneTemplate appends and commits a snippet as one undoable action", () => {
      render(<MarkdownEditor ref={ref} />);
      const before = useVideoStore.getState().markdown;
      let inserted = false;
      act(() => {
        inserted = ref.current!.insertSceneTemplate("!scene\n!text\nInserted\n!duration 2s");
      });

      expect(inserted).toBe(true);
      expect(useVideoStore.getState().markdown).toContain("Inserted");
      expect(useVideoStore.getState().markdown).toContain("\n\n---\n\n");
      expect(useVideoStore.getState().scenes).toHaveLength(2);
      expect(useVideoStore.getState().history.past).toEqual([before]);

      act(() => useVideoStore.getState().undo());
      expect(useVideoStore.getState().markdown).toBe(before);
    });

    it("inserts after the current scene rather than at the end when another scene follows", () => {
      resetStore("!scene\n!text\nOne\n!duration 1s\n\n---\n\n!scene\n!text\nTwo\n!duration 1s");
      render(<MarkdownEditor ref={ref} />);
      act(() => {
        ref.current!.insertSceneTemplate("!scene\n!text\nInserted\n!duration 2s");
      });

      const markdown = useVideoStore.getState().markdown;
      expect(markdown.indexOf("Inserted")).toBeLessThan(markdown.indexOf("Two"));
      expect(markdown).toContain("One\n!duration 1s\n\n---\n\n!scene\n!text\nInserted");
    });


    it("insertDirective targets the scene containing the editor cursor", () => {
      resetStore("!scene\n!text\nOne\n!duration 1s\n\n---\n\n!scene\n!text\nTwo\n!duration 1s");
      render(<MarkdownEditor ref={ref} />);
      const cursor = view().state.doc.toString().indexOf("Two");
      act(() => {
        view().dispatch({ selection: { anchor: cursor } });
        ref.current!.insertDirective("!background #123456");
      });

      const markdown = useVideoStore.getState().markdown;
      expect(markdown).toContain("Two\n!duration 1s\n!background #123456");
      expect(useVideoStore.getState().scenes[1].background).toBe("#123456");
    });
  });

  describe("imperative handle", () => {
    it("getText returns live uncommitted text", () => {
      render(<MarkdownEditor ref={ref} />);
      type(" pending");
      expect(ref.current!.getText()).toBe(INITIAL + " pending");
      expect(useVideoStore.getState().markdown).toBe(INITIAL);
    });

    it("flushPending commits synchronously", () => {
      render(<MarkdownEditor ref={ref} />);
      type(" pending");
      ref.current!.flushPending();
      expect(useVideoStore.getState().markdown).toBe(INITIAL + " pending");
    });

    it("the cross-component flush seam commits too", () => {
      render(<MarkdownEditor ref={ref} />);
      type(" pending");
      flushPendingEditorText();
      expect(useVideoStore.getState().markdown).toBe(INITIAL + " pending");
    });

    it("selectRange and getSelection round-trip exact UTF-16 offsets", () => {
      render(<MarkdownEditor ref={ref} />);
      act(() => {
        ref.current!.selectRange(0, 6);
      });
      expect(ref.current!.getSelection()).toEqual({ start: 0, end: 6 });
    });

    it("handles astral characters with UTF-16 offsets like JS strings", () => {
      resetStore("😀xy\nplain");
      render(<MarkdownEditor ref={ref} />);
      // The emoji is two UTF-16 code units; "xy" starts at offset 2.
      act(() => {
        ref.current!.selectRange(2, 4);
      });
      const selection = ref.current!.getSelection();
      expect(selection).toEqual({ start: 2, end: 4 });
      expect(view().state.sliceDoc(selection!.start, selection!.end)).toBe("xy");
    });

    it("replaceRange edits the live document and commits like typing", async () => {
      render(<MarkdownEditor ref={ref} />);
      act(() => {
        ref.current!.replaceRange(0, 6, "!replaced");
      });
      expect(view().state.doc.toString()).toContain("!replaced");
      await waitFor(
        () => expect(useVideoStore.getState().markdown).toContain("!replaced"),
        { timeout: 1500 }
      );
    });

    it("clamps out-of-range selections instead of throwing", () => {
      render(<MarkdownEditor ref={ref} />);
      act(() => {
        ref.current!.selectRange(-5, 99999);
      });
      const selection = ref.current!.getSelection();
      expect(selection).toEqual({ start: 0, end: INITIAL.length });
    });
  });

  describe("blur behavior", () => {
    it("flushes pending text when the editor loses focus", () => {
      render(<MarkdownEditor ref={ref} />);
      type(" pending");
      act(() => {
        view().contentDOM.dispatchEvent(new FocusEvent("blur"));
      });
      expect(useVideoStore.getState().markdown).toBe(INITIAL + " pending");
    });
  });
});
