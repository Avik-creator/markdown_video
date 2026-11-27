import type { SourceRange } from "@markdown-video/core";

export interface SceneTemplateInsertion {
  /** UTF-16 document offset at which `text` should be inserted. */
  offset: number;
  /** Already newline-normalized insertion text. */
  text: string;
  /** Whether the insertion was contextual or fell back to appending. */
  placement: "after-current-scene" | "inside-current-scene" | "append";
}

function detectNewline(markdown: string): string {
  return markdown.includes("\r\n") ? "\r\n" : "\n";
}

function normalizeTemplate(template: string, newline: string): string {
  return template.trim().replace(/\r\n/g, "\n").replace(/\n/g, newline);
}

function offsetAtLineStart(markdown: string, lineNumber: number): number | null {
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

function lineAt(markdown: string, offset: number): string {
  const end = markdown.indexOf("\n", offset);
  return markdown.slice(offset, end === -1 ? markdown.length : end).replace(/\r$/, "");
}

function appendInsertion(markdown: string, template: string, newline: string): SceneTemplateInsertion {
  if (!markdown.trim()) {
    return { offset: markdown.length, text: `${template}${newline}`, placement: "append" };
  }

  // Keep exactly one blank line before the horizontal rule regardless of
  // whether the existing document ends inline, on one newline, or already on
  // a blank line. Existing trailing content itself is never rewritten.
  let separator: string;
  if (markdown.endsWith(`${newline}${newline}`)) {
    separator = `---${newline}${newline}`;
  } else if (markdown.endsWith("\n")) {
    separator = `${newline}---${newline}${newline}`;
  } else {
    separator = `${newline}${newline}---${newline}${newline}`;
  }
  return {
    offset: markdown.length,
    text: `${separator}${template}${newline}`,
    placement: "append",
  };
}

/**
 * Compute a byte-preserving insertion for a full scene template after the
 * current scene. Between scenes, insertion happens immediately before the
 * next scene so the existing glue/separator before that scene now introduces
 * the inserted scene; a fresh separator is inserted after the template. At
 * the end (or when source ranges are inconsistent), the snippet is appended
 * using the document's own newline style.
 */
export function sceneTemplateInsertion(
  markdown: string,
  templateInput: string,
  sceneRanges: Array<SourceRange | undefined>,
  currentSceneIndex: number,
): SceneTemplateInsertion {
  const newline = detectNewline(markdown);
  const template = normalizeTemplate(templateInput, newline);
  const rangesValid =
    sceneRanges.length > 0 &&
    sceneRanges.every(
      (range, index) =>
        range &&
        Number.isInteger(range.startLine) &&
        Number.isInteger(range.endLine) &&
        range.startLine >= 1 &&
        range.startLine <= range.endLine &&
        (index === 0 || range.startLine > (sceneRanges[index - 1]?.endLine ?? 0))
    );

  if (
    rangesValid &&
    Number.isInteger(currentSceneIndex) &&
    currentSceneIndex >= 0 &&
    currentSceneIndex < sceneRanges.length - 1
  ) {
    const next = sceneRanges[currentSceneIndex + 1]!;
    const offset = offsetAtLineStart(markdown, next.startLine);
    if (offset !== null && lineAt(markdown, offset).trimStart().startsWith("!scene")) {
      return {
        offset,
        text: `${template}${newline}${newline}---${newline}${newline}`,
        placement: "after-current-scene",
      };
    }
  }

  return appendInsertion(markdown, template, newline);
}


function lineNumberAtOffset(markdown: string, offset: number): number {
  let line = 1;
  const bounded = Math.max(0, Math.min(offset, markdown.length));
  for (let index = 0; index < bounded; index++) {
    if (markdown.charCodeAt(index) === 10) line++;
  }
  return line;
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

/**
 * Resolve the scene a cursor belongs to. Cursors in inter-scene glue belong
 * to the preceding scene, which is the least surprising target for scene
 * directives and mirrors how a human reads the document.
 */
export function sceneIndexAtCursorLine(
  sceneRanges: Array<SourceRange | undefined>,
  lineNumber: number,
): number {
  if (!validSceneRanges(sceneRanges)) return -1;
  for (let index = 0; index < sceneRanges.length; index++) {
    const range = sceneRanges[index];
    if (lineNumber < range.startLine) return index - 1;
    if (lineNumber <= range.endLine) return index;
  }
  return sceneRanges.length - 1;
}

function contentEndOffsetAtLine(markdown: string, lineNumber: number): number | null {
  const start = offsetAtLineStart(markdown, lineNumber);
  if (start === null) return null;
  const newline = markdown.indexOf("\n", start);
  let end = newline === -1 ? markdown.length : newline;
  // In CRLF documents the carriage return is line-ending syntax, not content.
  // Insert before it rather than splitting it from its LF.
  if (end > start && markdown[end - 1] === "\r") end--;
  return end;
}

/**
 * Compute insertion of a scene-scoped directive scaffold. Directives are
 * inserted at the end of the scene containing the cursor (falling back to the
 * playback-current scene), never blindly at the caret where they could split
 * fenced code or content lines. Outside a valid scene, the directive is wrapped
 * in a minimal scene scaffold and inserted through the scene path instead.
 */
export function sceneDirectiveInsertion(
  markdown: string,
  directiveInput: string,
  sceneRanges: Array<SourceRange | undefined>,
  currentSceneIndex: number,
  cursorOffset: number,
): SceneTemplateInsertion {
  const newline = detectNewline(markdown);
  const directive = normalizeTemplate(directiveInput, newline);
  const cursorLine = lineNumberAtOffset(markdown, cursorOffset);
  const cursorSceneIndex = sceneIndexAtCursorLine(sceneRanges, cursorLine);
  const sceneIndex =
    cursorSceneIndex >= 0
      ? cursorSceneIndex
      : currentSceneIndex >= 0 && currentSceneIndex < sceneRanges.length
        ? currentSceneIndex
        : -1;

  if (validSceneRanges(sceneRanges) && sceneIndex >= 0 && sceneIndex < sceneRanges.length) {
    const range = sceneRanges[sceneIndex];
    const offset = contentEndOffsetAtLine(markdown, range.endLine);
    if (offset !== null) {
      return {
        offset,
        text: `${newline}${directive}`,
        placement: "inside-current-scene",
      };
    }
  }

  return sceneTemplateInsertion(
    markdown,
    `!scene${newline}${directive}`,
    sceneRanges,
    currentSceneIndex,
  );
}
