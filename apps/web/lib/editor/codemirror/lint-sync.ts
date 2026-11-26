import type { Text } from "@codemirror/state";
import type { Diagnostic as CmDiagnostic } from "@codemirror/lint";
import type { Diagnostic } from "@/lib/editor/diagnostics";

/**
 * Convert editor diagnostics to CodeMirror lint diagnostics.
 *
 * `Diagnostic.line` is 1-indexed; CM positions are 0-indexed UTF-16 code unit
 * offsets — the same units JavaScript strings use, so offsets line up with
 * the store's markdown text exactly, including across astral characters.
 * Document-level diagnostics (no line) stay panel-only and are not underlined.
 * Lines past the end of the document are clamped to the last line so a
 * diagnostic computed just before a deletion cannot crash the conversion.
 */
export function toCmDiagnostics(doc: Text, diagnostics: Diagnostic[]): CmDiagnostic[] {
  const result: CmDiagnostic[] = [];
  for (const d of diagnostics) {
    if (d.line === undefined) continue;
    const lineNumber = Math.max(1, Math.min(d.line, doc.lines));
    const line = doc.line(lineNumber);
    result.push({
      from: line.from,
      to: line.to,
      severity: d.severity,
      message: d.message,
    });
  }
  return result;
}

export interface LocalizedFix {
  from: number;
  to: number;
  insert: string;
}

/**
 * Compute the localized document change for a diagnostic fix, mirroring
 * `applyFix` exactly: the replacement applies `String.replace` semantics to
 * the diagnostic's line only (first occurrence, `$` patterns in the
 * replacement string included). Returns null when no change is meaningful —
 * the same cases where `applyFix` would return the text unchanged.
 */
export function diagnosticFixChange(doc: Text, diagnostic: Diagnostic): LocalizedFix | null {
  if (!diagnostic.fix || diagnostic.line === undefined) return null;
  if (diagnostic.line < 1 || diagnostic.line > doc.lines) return null;

  const line = doc.line(diagnostic.line);
  const replaced = line.text.replace(diagnostic.fix.find, diagnostic.fix.replace);
  return { from: line.from, to: line.to, insert: replaced };
}
