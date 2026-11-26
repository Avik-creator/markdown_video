// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { Transaction } from "@codemirror/state";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "../markdown-editor";
import { FindReplace } from "../find-replace";
import { useVideoStore } from "@/lib/use-video-store";
import { getActiveEditorView } from "@/lib/editor/codemirror/store-sync";
import type { EditorView } from "@codemirror/view";

function view(): EditorView {
  const v = getActiveEditorView();
  if (!v) throw new Error("editor view not registered");
  return v;
}

function resetStore(markdown: string) {
  useVideoStore.getState().setMarkdown(markdown, false);
  useVideoStore.setState({
    history: { past: [], future: [] },
    highlightRange: null,
    findText: "",
    replaceText: "",
  });
}

function type(insert: string, from = view().state.doc.length) {
  act(() => {
    view().dispatch({
      changes: { from, insert },
      selection: { anchor: from + insert.length },
      annotations: Transaction.userEvent.of("input.type"),
    });
  });
}

function input(el: Element, value: string) {
  act(() => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function keydownOn(el: Element, key: string, shiftKey = false) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }));
  });
}

describe("FindReplace + CodeMirror integration", () => {
  let editorRef: React.RefObject<MarkdownEditorHandle | null>;

  beforeEach(() => {
    editorRef = createRef<MarkdownEditorHandle>();
  });

  afterEach(() => {
    cleanup();
  });

  function renderBoth(markdown: string, showReplace = false) {
    resetStore(markdown);
    return render(
      <>
        <MarkdownEditor ref={editorRef} />
        <FindReplace open onClose={() => {}} showReplace={showReplace} editorRef={editorRef} />
      </>
    );
  }

  it("selects matches in the live CM document with exact offsets", async () => {
    renderBoth("alpha beta alpha");
    input(document.querySelector("input[aria-label='Find text']")!, "alpha");
    await waitFor(() => {
      expect(editorRef.current!.getSelection()).toEqual({ start: 0, end: 5 });
    });
    expect(document.body.textContent).toContain("1 of 2");
  });

  it("navigates next/previous with Enter and Shift+Enter with wraparound", async () => {
    renderBoth("alpha beta alpha");
    const findInput = document.querySelector("input[aria-label='Find text']")!;
    input(findInput, "alpha");
    await waitFor(() => expect(editorRef.current!.getSelection()).toEqual({ start: 0, end: 5 }));

    keydownOn(findInput, "Enter");
    await waitFor(() => expect(editorRef.current!.getSelection()).toEqual({ start: 11, end: 16 }));

    // Wraparound back to the first match.
    keydownOn(findInput, "Enter");
    await waitFor(() => expect(editorRef.current!.getSelection()).toEqual({ start: 0, end: 5 }));

    keydownOn(findInput, "Enter", true);
    await waitFor(() => expect(editorRef.current!.getSelection()).toEqual({ start: 11, end: 16 }));
  });

  it("treats offsets as UTF-16 code units across astral characters", async () => {
    // 😀 is two UTF-16 code units; the second "xy" starts at 2+2+1+1 = 6.
    renderBoth("😀xy\nxy");
    input(document.querySelector("input[aria-label='Find text']")!, "xy");
    await waitFor(() => expect(editorRef.current!.getSelection()).toEqual({ start: 2, end: 4 }));

    const findInput = document.querySelector("input[aria-label='Find text']")!;
    keydownOn(findInput, "Enter");
    await waitFor(() => expect(editorRef.current!.getSelection()).toEqual({ start: 5, end: 7 }));
    expect(view().state.sliceDoc(5, 7)).toBe("xy");
  });

  it("replaces exactly the current match, not the first occurrence", async () => {
    renderBoth("foo bar foo", true);
    const findInput = document.querySelector("input[aria-label='Find text']")!;
    input(findInput, "foo");
    const replaceInput = document.querySelector("input[aria-label='Replace text']")!;
    input(replaceInput, "baz");

    // Navigate to the second match, then replace it.
    keydownOn(findInput, "Enter");
    await waitFor(() => expect(editorRef.current!.getSelection()).toEqual({ start: 8, end: 11 }));

    keydownOn(replaceInput, "Enter");
    await waitFor(() => expect(useVideoStore.getState().markdown).toBe("foo bar baz"));
    expect(view().state.doc.toString()).toBe("foo bar baz");
  });

  it("replaces using live text even when typing is uncommitted", async () => {
    renderBoth("foo end");
    // Type more text without letting the commit debounce fire.
    type(" foo");
    expect(useVideoStore.getState().markdown).toBe("foo end");

    const findInput = document.querySelector("input[aria-label='Find text']")!;
    input(findInput, "foo");
    // The match inside the uncommitted text must be found.
    await waitFor(() => expect(document.body.textContent).toContain("1 of 2"));
  });

  it("replace-all applies to the live document", async () => {
    renderBoth("foo bar foo", true);
    type(" foo");
    const findInput = document.querySelector("input[aria-label='Find text']")!;
    input(findInput, "foo");
    const replaceInput = document.querySelector("input[aria-label='Replace text']")!;
    input(replaceInput, "x");

    const allButton = [...document.querySelectorAll("button")].find((b) => b.textContent === "All")!;
    act(() => allButton.click());
    expect(useVideoStore.getState().markdown).toBe("x bar x x");
    expect(view().state.doc.toString()).toBe("x bar x x");
  });

  it("shows No match when nothing matches", async () => {
    renderBoth("nothing here");
    input(document.querySelector("input[aria-label='Find text']")!, "zzz");
    await waitFor(() => expect(document.body.textContent).toContain("No match"));
  });
});
