import { describe, expect, it } from "vitest";
import { EditorState, EditorSelection } from "@codemirror/state";
import { toggleCommentInText, toggleCommentCommand } from "../comments";

// These cases pin the exact semantics the textarea implementation had,
// because the rewrite must be behavior-identical.
describe("toggleCommentInText", () => {
  function run(text: string, start: number, end: number) {
    return toggleCommentInText(text, start, end);
  }

  it("comments a single uncommented line under the caret", () => {
    const result = run("hello world", 4, 4);
    expect(result.text).toBe("// hello world");
    // The whole line ends up selected.
    expect(result.selStart).toBe(0);
    expect(result.selEnd).toBe("// hello world".length);
  });

  it("expands a partial multi-line selection to whole lines", () => {
    const text = "alpha\nbeta\ngamma";
    // Selection inside alpha through inside beta.
    const result = run(text, 2, 8);
    expect(result.text).toBe("// alpha\n// beta\ngamma");
    expect(result.selStart).toBe(0);
    expect(result.selEnd).toBe("// alpha\n// beta".length);
  });

  it("uncomments when every selected line is commented", () => {
    const text = "// alpha\n// beta";
    const result = run(text, 0, text.length);
    expect(result.text).toBe("alpha\nbeta");
  });

  it("removes the comment marker without requiring a space after it", () => {
    const result = run("//nospace", 0, 9);
    expect(result.text).toBe("nospace");
  });

  it("removes only one optional space after the marker", () => {
    const result = run("//  two spaces", 0, 14);
    expect(result.text).toBe(" two spaces");
  });

  it("preserves indentation when commenting and uncommenting", () => {
    const commented = run("  indented", 0, 10);
    expect(commented.text).toBe("  // indented");
    const uncommented = run("  // indented", 0, 13);
    expect(uncommented.text).toBe("  indented");
  });

  it("leaves blank lines untouched while commenting", () => {
    const text = "one\n\nthree";
    const result = run(text, 0, text.length);
    expect(result.text).toBe("// one\n\n// three");
  });

  it("leaves whitespace-only lines untouched while commenting", () => {
    const text = "one\n   \nthree";
    const result = run(text, 0, text.length);
    expect(result.text).toBe("// one\n   \n// three");
  });

  it("comments everything again when only some lines are commented", () => {
    const text = "// alpha\nbeta";
    const result = run(text, 0, text.length);
    expect(result.text).toBe("// // alpha\n// beta");
  });

  it("includes the line a selection ends at the start of", () => {
    // Selection covers all of line one plus the newline, ending exactly at
    // the start of line two. The textarea version included line two.
    const text = "one\ntwo";
    const result = run(text, 0, 4);
    expect(result.text).toBe("// one\n// two");
  });

  it("uses the final line without a trailing newline correctly", () => {
    const text = "one\ntwo";
    const result = run(text, 4, 7);
    expect(result.text).toBe("one\n// two");
  });

  it("restores the selection over the toggled lines", () => {
    const text = "alpha\nbeta";
    const result = run(text, 2, 8);
    expect(result.text.slice(result.selStart, result.selEnd)).toBe("// alpha\n// beta");
  });
});

describe("toggleCommentCommand", () => {
  function stateWith(text: string, start: number, end: number) {
    return EditorState.create({
      doc: text,
      selection: EditorSelection.range(start, end),
    });
  }

  function runCommand(text: string, start: number, end: number) {
    const state = stateWith(text, start, end);
    let next = state;
    const applied = toggleCommentCommand({
      state,
      dispatch: (tr) => {
        next = tr.state;
      },
    });
    return { applied, next };
  }

  it("applies the same edit as the text version", () => {
    const text = "alpha\nbeta\ngamma";
    const { applied, next } = runCommand(text, 2, 8);
    expect(applied).toBe(true);
    expect(next.doc.toString()).toBe(toggleCommentInText(text, 2, 8).text);
  });

  it("produces the same selection as the text version", () => {
    const text = "alpha\nbeta";
    const expected = toggleCommentInText(text, 2, 8);
    const { next } = runCommand(text, 2, 8);
    const range = next.selection.main;
    expect(range.from).toBe(expected.selStart);
    expect(range.to).toBe(expected.selEnd);
  });

  it("only changes the affected line range", () => {
    const text = "untouched first\nmid one\nmid two\nuntouched last";
    const start = text.indexOf("mid one") + 2;
    const end = text.indexOf("mid two") + 3;
    const { next } = runCommand(text, start, end);
    const lines = next.doc.toString().split("\n");
    expect(lines[0]).toBe("untouched first");
    expect(lines[3]).toBe("untouched last");
    expect(lines[1]).toBe("// mid one");
    expect(lines[2]).toBe("// mid two");
  });

  it("round-trips: commenting then uncommenting restores the document", () => {
    const text = "alpha\nbeta";
    const first = runCommand(text, 0, text.length);
    const sel = first.next.selection.main;
    const second = runCommand(first.next.doc.toString(), sel.from, sel.to);
    expect(second.next.doc.toString()).toBe(text);
  });
});
