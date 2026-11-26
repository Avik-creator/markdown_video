import {
  RangeSet,
  StateEffect,
  StateField,
  type Range,
  type Text,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  gutterLineClass,
  GutterMarker,
  type DecorationSet,
} from "@codemirror/view";
import type { Diagnostic } from "@/lib/editor/diagnostics";
import type { SourceRange } from "@markdown-video/core";

/**
 * Line-oriented visual markers shown in the editor: the pink source-range
 * highlight linking a property panel to the code it came from, and the
 * error/warning tinting that used to be painted by the manual overlay divs.
 */
export interface EditorMarkers {
  highlight: SourceRange | null;
  problemsByLine: ReadonlyMap<number, Diagnostic[]>;
}

export const EMPTY_MARKERS: EditorMarkers = {
  highlight: null,
  problemsByLine: new Map(),
};

export const setEditorMarkersEffect = StateEffect.define<EditorMarkers>();

function severityOf(problems: readonly Diagnostic[]): "error" | "warning" {
  return problems.some((d) => d.severity === "error") ? "error" : "warning";
}

interface LineStyle {
  contentClass: string;
  gutterClass: string;
}

/** Resolve the classes for one line, with the highlight winning over problems. */
function lineStyle(
  lineNumber: number,
  markers: EditorMarkers
): LineStyle | null {
  const { highlight, problemsByLine } = markers;
  if (
    highlight &&
    lineNumber >= highlight.startLine &&
    lineNumber <= highlight.endLine
  ) {
    const classes = ["cm-md-highlight-line"];
    if (lineNumber === highlight.startLine) classes.push("cm-md-highlight-first");
    if (lineNumber === highlight.endLine) classes.push("cm-md-highlight-last");
    return { contentClass: classes.join(" "), gutterClass: "cm-md-highlight-gutter" };
  }

  const problems = problemsByLine.get(lineNumber);
  if (problems && problems.length > 0) {
    const severity = severityOf(problems);
    return {
      contentClass: `cm-md-${severity}-line`,
      gutterClass: `cm-md-${severity}-gutter`,
    };
  }
  return null;
}

function eachStyledLine(
  doc: Text,
  markers: EditorMarkers,
  visit: (lineNumber: number, style: LineStyle) => void
) {
  const candidates = new Set<number>();
  if (markers.highlight) {
    const start = Math.max(1, markers.highlight.startLine);
    const end = Math.min(doc.lines, markers.highlight.endLine);
    for (let line = start; line <= end; line++) candidates.add(line);
  }
  for (const line of markers.problemsByLine.keys()) {
    if (line >= 1 && line <= doc.lines) candidates.add(line);
  }

  const ordered = [...candidates].sort((a, b) => a - b);
  for (const line of ordered) {
    const style = lineStyle(line, markers);
    if (style) visit(line, style);
  }
}

/** Line decorations reproducing the overlay tints and highlight bands. */
export function buildLineDecorations(doc: Text, markers: EditorMarkers): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  eachStyledLine(doc, markers, (lineNumber, style) => {
    decorations.push({
      from: doc.line(lineNumber).from,
      to: doc.line(lineNumber).from,
      value: Decoration.line({ class: style.contentClass }),
    });
  });
  return Decoration.set(decorations, true);
}

class ClassGutterMarker extends GutterMarker {
  constructor(readonly elementClass: string) {
    super();
  }
  eq(other: ClassGutterMarker) {
    return other.elementClass === this.elementClass;
  }
}

/** Gutter-row classes so line numbers pick up the highlight/problem colors. */
export function buildGutterMarkers(
  doc: Text,
  markers: EditorMarkers
): RangeSet<GutterMarker> {
  const ranges: { from: number; to: number; value: GutterMarker }[] = [];
  eachStyledLine(doc, markers, (lineNumber, style) => {
    const pos = doc.line(lineNumber).from;
    ranges.push({ from: pos, to: pos, value: new ClassGutterMarker(style.gutterClass) });
  });
  return RangeSet.of(ranges, true);
}

interface MarkerSets {
  decorations: DecorationSet;
  gutterMarkers: RangeSet<GutterMarker>;
}

/**
 * Holds the current marker decorations. Updated wholesale when the editor
 * dispatches {@link setEditorMarkersEffect}; mapped through document changes
 * in between so positions stay roughly right until the next validation pass
 * (or until the edit clears the highlight).
 */
export const editorMarkersField = StateField.define<MarkerSets>({
  create() {
    return { decorations: Decoration.none, gutterMarkers: RangeSet.empty };
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setEditorMarkersEffect)) {
        return {
          decorations: buildLineDecorations(tr.state.doc, effect.value),
          gutterMarkers: buildGutterMarkers(tr.state.doc, effect.value),
        };
      }
    }
    if (tr.docChanged) {
      return {
        decorations: value.decorations.map(tr.changes),
        gutterMarkers: value.gutterMarkers.map(tr.changes),
      };
    }
    return value;
  },
  provide: (field) => [
    EditorView.decorations.from(field, (v) => v.decorations),
    gutterLineClass.from(field, (v) => v.gutterMarkers),
  ],
});
