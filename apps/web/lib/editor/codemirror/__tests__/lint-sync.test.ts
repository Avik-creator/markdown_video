import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { Text } from "@codemirror/state";
import { toCmDiagnostics, diagnosticFixChange } from "../lint-sync";
import { applyFix, type Diagnostic } from "@/lib/editor/diagnostics";

function doc(text: string) {
  return Text.of(text.split("\n"));
}

describe("toCmDiagnostics", () => {
  it("converts a 1-indexed line to whole-line UTF-16 offsets", () => {
    const text = "ab\ncd\nef";
    const diagnostics: Diagnostic[] = [
      { line: 2, severity: "error", message: "broken" },
    ];
    const result = toCmDiagnostics(doc(text), diagnostics);
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe(3);
    expect(result[0].to).toBe(5);
    expect(result[0].severity).toBe("error");
    expect(result[0].message).toBe("broken");
  });

  it("keeps document-level diagnostics out of the lint set", () => {
    const result = toCmDiagnostics(doc("abc"), [
      { severity: "warning", message: "whole document problem" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("clamps lines past the end of the document to the last line", () => {
    const text = "only\nlines";
    const result = toCmDiagnostics(doc(text), [
      { line: 99, severity: "error", message: "too far" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe(5);
    expect(result[0].to).toBe(10);
  });

  it("handles empty lines as zero-width ranges", () => {
    const text = "a\n\nb";
    const result = toCmDiagnostics(doc(text), [
      { line: 2, severity: "warning", message: "empty" },
    ]);
    expect(result[0].from).toBe(2);
    expect(result[0].to).toBe(2);
  });

  it("uses UTF-16 code unit offsets when astral characters precede the line", () => {
    // The emoji is two UTF-16 code units, so the next line starts at 2+1+1.
    const text = "😀\nnext";
    const result = toCmDiagnostics(doc(text), [
      { line: 2, severity: "error", message: "after emoji" },
    ]);
    expect(result[0].from).toBe(3);
    expect(result[0].to).toBe(7);
  });

  it("uses UTF-16 offsets when the line itself contains astral characters", () => {
    const text = "x😀y";
    const result = toCmDiagnostics(doc(text), [
      { line: 1, severity: "error", message: "astral" },
    ]);
    expect(result[0].from).toBe(0);
    expect(result[0].to).toBe(4); // 1 + 2 + 1 code units
  });

  it("preserves ordering and severity mapping", () => {
    const result = toCmDiagnostics(doc("a\nb"), [
      { line: 1, severity: "warning", message: "w" },
      { line: 2, severity: "error", message: "e" },
    ]);
    expect(result.map((d) => d.severity)).toEqual(["warning", "error"]);
  });
});

describe("diagnosticFixChange", () => {
  function state(text: string) {
    return EditorState.create({ doc: text });
  }

  it("returns null when the diagnostic has no fix", () => {
    expect(
      diagnosticFixChange(state("abc").doc, { line: 1, severity: "error", message: "m" })
    ).toBeNull();
  });

  it("returns null when the diagnostic has no line", () => {
    expect(
      diagnosticFixChange(state("abc").doc, {
        severity: "error",
        message: "m",
        fix: { find: "a", replace: "b" },
      })
    ).toBeNull();
  });

  it("produces a change localized to the fixed line", () => {
    const text = "first\nsecnd\nthird";
    const change = diagnosticFixChange(state(text).doc, {
      line: 2,
      severity: "error",
      message: "typo",
      fix: { find: "secnd", replace: "second" },
    });
    expect(change).not.toBeNull();
    expect(text.slice(change!.from, change!.to)).toBe("secnd");
    expect(change!.insert).toBe("second");
  });

  it("matches applyFix output when the change is applied", () => {
    const text = "!duraton 3s\nnext line";
    const diagnostic: Diagnostic = {
      line: 1,
      severity: "error",
      message: "typo",
      fix: { find: "!duraton", replace: "!duration" },
    };
    const change = diagnosticFixChange(state(text).doc, diagnostic);
    const stateBefore = state(text);
    const tr = stateBefore.update({
      changes: { from: change!.from, to: change!.to, insert: change!.insert },
    });
    expect(tr.state.doc.toString()).toBe(applyFix(text, diagnostic));
  });

  it("replaces only the first occurrence within the line", () => {
    const text = "ab ab ab";
    const change = diagnosticFixChange(state(text).doc, {
      line: 1,
      severity: "error",
      message: "m",
      fix: { find: "ab", replace: "xy" },
    });
    expect(change!.insert).toBe("xy ab ab");
  });

  it("does not touch occurrences on other lines", () => {
    const text = "secnd\nsecnd";
    const change = diagnosticFixChange(state(text).doc, {
      line: 1,
      severity: "error",
      message: "m",
      fix: { find: "secnd", replace: "second" },
    });
    expect(change!.insert).toBe("second");
    expect(text.slice(change!.from, change!.to)).toBe("secnd");
  });

  it("mirrors String.replace substitution semantics for $ patterns", () => {
    // applyFix uses String.prototype.replace, so `$&` in the replacement
    // inserts the matched text. Lock that in rather than 'fixing' it.
    const text = "hello";
    const diagnostic: Diagnostic = {
      line: 1,
      severity: "error",
      message: "m",
      fix: { find: "ell", replace: "[$&]" },
    };
    const change = diagnosticFixChange(state(text).doc, diagnostic);
    expect(change!.insert).toBe("h[ell]o");
    expect(change!.insert).toBe(applyFix(text, diagnostic));
  });

  it("returns null for lines beyond the end of the document", () => {
    // applyFix leaves the text unchanged in this case, so there is no
    // meaningful localized change to dispatch.
    const change = diagnosticFixChange(state("short").doc, {
      line: 42,
      severity: "error",
      message: "m",
      fix: { find: "x", replace: "y" },
    });
    expect(change).toBeNull();
  });
});
