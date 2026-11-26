import { validateMarkdownSyntax } from "@/lib/mcp/syntax-validator";

export interface Diagnostic {
  /** 1-indexed line, or undefined for problems with the whole document. */
  line?: number;
  severity: "error" | "warning";
  message: string;
  suggestion?: string;
  fix?: { find: string; replace: string };
}

/**
 * Problems to show in the editor: the same validation the MCP server runs,
 * sorted by line, with document-level problems last.
 */
export function getDiagnostics(markdown: string): Diagnostic[] {
  if (markdown.trim() === "") return [];

  const { errors, warnings } = validateMarkdownSyntax(markdown);
  const all: Diagnostic[] = [...errors, ...warnings].map((d) => ({
    line: d.line,
    severity: d.severity === "error" ? "error" : "warning",
    message: d.message,
    suggestion: d.suggestion,
    fix: d.fix,
  }));

  return all.sort((a, b) => {
    const la = a.line ?? Number.MAX_SAFE_INTEGER;
    const lb = b.line ?? Number.MAX_SAFE_INTEGER;
    if (la !== lb) return la - lb;
    return a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1;
  });
}

/** Problems grouped by line, for the gutter and line tints. */
export function diagnosticsByLine(diagnostics: Diagnostic[]): Map<number, Diagnostic[]> {
  const byLine = new Map<number, Diagnostic[]>();
  for (const d of diagnostics) {
    if (d.line === undefined) continue;
    const list = byLine.get(d.line) ?? [];
    list.push(d);
    byLine.set(d.line, list);
  }
  return byLine;
}

/** Apply a diagnostic's fix to the given line. Returns the new text. */
export function applyFix(markdown: string, diagnostic: Diagnostic): string {
  if (!diagnostic.fix || diagnostic.line === undefined) return markdown;
  const lines = markdown.split("\n");
  const index = diagnostic.line - 1;
  if (index < 0 || index >= lines.length) return markdown;
  lines[index] = lines[index].replace(diagnostic.fix.find, diagnostic.fix.replace);
  return lines.join("\n");
}
