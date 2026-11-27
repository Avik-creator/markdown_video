import type { SourceRange } from "@markdown-video/core";

export type SceneOperation = "duplicate" | "delete";

function detectNewline(markdown: string): string {
  return markdown.includes("\r\n") ? "\r\n" : "\n";
}

function lineStartOffset(markdown: string, lineNumber: number): number | null {
  if (!Number.isInteger(lineNumber) || lineNumber < 1) return null;
  if (lineNumber === 1) return 0;
  let offset = 0;
  for (let line = 1; line < lineNumber; line++) {
    const newline = markdown.indexOf("\n", offset);
    if (newline === -1) return null;
    offset = newline + 1;
  }
  return offset <= markdown.length ? offset : null;
}

function nextLineStartOffset(markdown: string, lineNumber: number): number | null {
  const start = lineStartOffset(markdown, lineNumber);
  if (start === null) return null;
  const newline = markdown.indexOf("\n", start);
  return newline === -1 ? markdown.length : newline + 1;
}

function validSceneRanges(sceneRanges: Array<SourceRange | undefined>): sceneRanges is SourceRange[] {
  return (
    sceneRanges.length > 0 &&
    sceneRanges.every(
      (range, index) =>
        range &&
        Number.isInteger(range.startLine) &&
        Number.isInteger(range.endLine) &&
        range.startLine >= 1 &&
        range.startLine <= range.endLine &&
        (index === 0 || range.startLine > (sceneRanges[index - 1]?.endLine ?? 0))
    )
  );
}

function structuralGlue(markdown: string, from: number, to: number): boolean {
  // Only blank lines and horizontal scene separators are disposable glue.
  // Comments, variables, music, or malformed/unrecognized lines are user
  // content and must stay anchored even if that leaves one extra separator.
  return markdown
    .slice(from, to)
    .split(/\r?\n/)
    .every((line) => line.trim() === "" || line.trim() === "---");
}

interface SceneSpan {
  start: number;
  end: number;
}

function sceneSpans(markdown: string, ranges: SourceRange[]): SceneSpan[] | null {
  const spans: SceneSpan[] = [];
  for (const range of ranges) {
    const start = lineStartOffset(markdown, range.startLine);
    const end = nextLineStartOffset(markdown, range.endLine);
    if (start === null || end === null || start >= end) return null;
    spans.push({ start, end });
  }
  return spans;
}

function duplicateScene(markdown: string, spans: SceneSpan[], index: number): string {
  const newline = detectNewline(markdown);
  const span = spans[index];
  const block = markdown.slice(span.start, span.end);
  const glue = `${newline}---${newline}${newline}`;

  if (index < spans.length - 1) {
    // The existing glue before the next scene now introduces the duplicate;
    // add a fresh separator after the duplicate for the original next scene.
    const at = spans[index + 1].start;
    const blockWithBoundary = block.endsWith("\n")
      ? `${block}${glue}`
      : `${block}${newline}${glue}`;
    return markdown.slice(0, at) + blockWithBoundary + markdown.slice(at);
  }

  // For the final scene, append after the document rather than moving any
  // trailing document-level content. Separation is normalized without
  // rewriting existing trailing bytes.
  let prefix = "";
  if (markdown.trim()) {
    if (!markdown.endsWith("\n")) prefix += newline;
    if (!markdown.endsWith(`${newline}${newline}`)) prefix += newline;
    prefix += `---${newline}${newline}`;
  }
  const suffix = block.endsWith("\n") || markdown.length === 0 ? block : `${block}${newline}`;
  return markdown + prefix + suffix;
}

function deleteScene(markdown: string, spans: SceneSpan[], index: number): string {
  const span = spans[index];
  let start = span.start;
  let end = span.end;

  if (index < spans.length - 1) {
    const nextStart = spans[index + 1].start;
    if (structuralGlue(markdown, span.end, nextStart)) {
      end = nextStart;
    }
  } else if (index > 0) {
    const previousEnd = spans[index - 1].end;
    if (structuralGlue(markdown, previousEnd, span.start)) {
      start = previousEnd;
    }
  }

  return markdown.slice(0, start) + markdown.slice(end);
}

/**
 * Duplicate or delete one parser-identified scene while preserving all bytes
 * outside the necessary scene/separator span. Returns null when source ranges
 * are inconsistent; callers must treat that as a no-op rather than risking a
 * partial rewrite.
 */
export function rewriteSceneOperation(
  markdown: string,
  sceneRanges: Array<SourceRange | undefined>,
  sceneIndex: number,
  operation: SceneOperation,
): string | null {
  if (!validSceneRanges(sceneRanges)) return null;
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0 || sceneIndex >= sceneRanges.length) return null;
  const spans = sceneSpans(markdown, sceneRanges);
  if (!spans) return null;
  return operation === "duplicate"
    ? duplicateScene(markdown, spans, sceneIndex)
    : deleteScene(markdown, spans, sceneIndex);
}
