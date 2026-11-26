import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import type { Decoration, DecorationSet, GutterMarker } from "@codemirror/view";
import type { RangeSet } from "@codemirror/state";
import {
  buildLineDecorations,
  buildGutterMarkers,
  editorMarkersField,
  setEditorMarkersEffect,
  type EditorMarkers,
} from "../line-marks";
import { EditorState } from "@codemirror/state";
import type { Diagnostic } from "@/lib/editor/diagnostics";

function docOf(text: string) {
  return Text.of(text.split("\n"));
}

function lineDecoClasses(set: DecorationSet, doc: ReturnType<typeof docOf>) {
  const classes = new Map<number, string>();
  set.between(0, doc.length, (from, _to, deco: Decoration) => {
    const line = doc.lineAt(from).number;
    const cls = (deco.spec as { class?: string }).class;
    if (cls) classes.set(line, (classes.get(line) ?? "") + " " + cls);
  });
  return classes;
}

function gutterClasses(set: RangeSet<GutterMarker>, doc: ReturnType<typeof docOf>) {
  const classes = new Map<number, string>();
  set.between(0, doc.length, (from, _to, marker: GutterMarker) => {
    const line = doc.lineAt(from).number;
    classes.set(line, (classes.get(line) ?? "") + " " + marker.elementClass);
  });
  return classes;
}

const errorAt = (line: number): Diagnostic => ({
  line,
  severity: "error",
  message: `error on ${line}`,
});
const warningAt = (line: number): Diagnostic => ({
  line,
  severity: "warning",
  message: `warning on ${line}`,
});

describe("buildLineDecorations", () => {
  it("decorates every highlighted line with the highlight class", () => {
    const doc = docOf("one\ntwo\nthree\nfour");
    const markers: EditorMarkers = {
      highlight: { startLine: 2, endLine: 3 },
      problemsByLine: new Map(),
    };
    const classes = lineDecoClasses(buildLineDecorations(doc, markers), doc);
    expect(classes.get(2)).toContain("cm-md-highlight-line");
    expect(classes.get(3)).toContain("cm-md-highlight-line");
    expect(classes.get(1)).toBeUndefined();
    expect(classes.get(4)).toBeUndefined();
  });

  it("marks the first and last highlighted lines for rounded corners", () => {
    const doc = docOf("one\ntwo\nthree\nfour");
    const classes = lineDecoClasses(
      buildLineDecorations(doc, {
        highlight: { startLine: 2, endLine: 3 },
        problemsByLine: new Map(),
      }),
      doc
    );
    expect(classes.get(2)).toContain("cm-md-highlight-first");
    expect(classes.get(2)).not.toContain("cm-md-highlight-last");
    expect(classes.get(3)).toContain("cm-md-highlight-last");
  });

  it("marks a single-line highlight as both first and last", () => {
    const doc = docOf("one\ntwo\nthree");
    const classes = lineDecoClasses(
      buildLineDecorations(doc, {
        highlight: { startLine: 2, endLine: 2 },
        problemsByLine: new Map(),
      }),
      doc
    );
    expect(classes.get(2)).toContain("cm-md-highlight-first");
    expect(classes.get(2)).toContain("cm-md-highlight-last");
  });

  it("decorates error and warning lines with severity classes", () => {
    const doc = docOf("one\ntwo\nthree");
    const classes = lineDecoClasses(
      buildLineDecorations(doc, {
        highlight: null,
        problemsByLine: new Map([
          [1, [errorAt(1)]],
          [3, [warningAt(3)]],
        ]),
      }),
      doc
    );
    expect(classes.get(1)).toContain("cm-md-error-line");
    expect(classes.get(3)).toContain("cm-md-warning-line");
    expect(classes.get(2)).toBeUndefined();
  });

  it("uses error styling when a line has both errors and warnings", () => {
    const doc = docOf("one");
    const classes = lineDecoClasses(
      buildLineDecorations(doc, {
        highlight: null,
        problemsByLine: new Map([[1, [warningAt(1), errorAt(1)]]]),
      }),
      doc
    );
    expect(classes.get(1)).toContain("cm-md-error-line");
    expect(classes.get(1)).not.toContain("cm-md-warning-line");
  });

  it("lets the highlight override problem styling on the same line", () => {
    const doc = docOf("one\ntwo");
    const classes = lineDecoClasses(
      buildLineDecorations(doc, {
        highlight: { startLine: 1, endLine: 1 },
        problemsByLine: new Map([[1, [errorAt(1)]]]),
      }),
      doc
    );
    expect(classes.get(1)).toContain("cm-md-highlight-line");
    expect(classes.get(1)).not.toContain("cm-md-error-line");
  });

  it("skips lines beyond the end of the document", () => {
    const doc = docOf("one");
    const classes = lineDecoClasses(
      buildLineDecorations(doc, {
        highlight: { startLine: 1, endLine: 5 },
        problemsByLine: new Map([[9, [errorAt(9)]]]),
      }),
      doc
    );
    expect(classes.get(1)).toContain("cm-md-highlight-line");
    expect([...classes.keys()]).toEqual([1]);
  });
});

describe("buildGutterMarkers", () => {
  it("colors gutter rows for highlighted lines pink", () => {
    const doc = docOf("one\ntwo");
    const classes = gutterClasses(
      buildGutterMarkers(doc, {
        highlight: { startLine: 2, endLine: 2 },
        problemsByLine: new Map(),
      }),
      doc
    );
    expect(classes.get(2)).toContain("cm-md-highlight-gutter");
  });

  it("colors problem gutter rows by severity", () => {
    const doc = docOf("one\ntwo");
    const classes = gutterClasses(
      buildGutterMarkers(doc, {
        highlight: null,
        problemsByLine: new Map([
          [1, [errorAt(1)]],
          [2, [warningAt(2)]],
        ]),
      }),
      doc
    );
    expect(classes.get(1)).toContain("cm-md-error-gutter");
    expect(classes.get(2)).toContain("cm-md-warning-gutter");
  });

  it("prefers the highlight color over problem colors", () => {
    const doc = docOf("one");
    const classes = gutterClasses(
      buildGutterMarkers(doc, {
        highlight: { startLine: 1, endLine: 1 },
        problemsByLine: new Map([[1, [errorAt(1)]]]),
      }),
      doc
    );
    expect(classes.get(1)).toContain("cm-md-highlight-gutter");
    expect(classes.get(1)).not.toContain("cm-md-error-gutter");
  });
});

describe("editorMarkersField", () => {
  function stateWithField(text: string) {
    return EditorState.create({ doc: text, extensions: [editorMarkersField] });
  }

  it("starts empty", () => {
    const state = stateWithField("one\ntwo");
    const value = state.field(editorMarkersField);
    let count = 0;
    value.decorations.between(0, 10, () => { count++; });
    expect(count).toBe(0);
  });

  it("rebuilds decorations when the effect is dispatched", () => {
    let state = stateWithField("one\ntwo\nthree");
    const markers: EditorMarkers = {
      highlight: { startLine: 2, endLine: 2 },
      problemsByLine: new Map([[1, [errorAt(1)]]]),
    };
    const tr = state.update({ effects: setEditorMarkersEffect.of(markers) });
    state = tr.state;
    const classes = lineDecoClasses(state.field(editorMarkersField).decorations, state.doc);
    expect(classes.get(2)).toContain("cm-md-highlight-line");
    expect(classes.get(1)).toContain("cm-md-error-line");
  });

  it("clears decorations when dispatched with empty markers", () => {
    let state = stateWithField("one\ntwo");
    state = state.update({
      effects: setEditorMarkersEffect.of({
        highlight: { startLine: 1, endLine: 1 },
        problemsByLine: new Map(),
      }),
    }).state;
    state = state.update({
      effects: setEditorMarkersEffect.of({ highlight: null, problemsByLine: new Map() }),
    }).state;
    let count = 0;
    state.field(editorMarkersField).decorations.between(0, 10, () => { count++; });
    expect(count).toBe(0);
  });
});
