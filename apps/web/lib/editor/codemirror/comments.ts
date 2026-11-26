import type { StateCommand } from "@codemirror/state";
import { EditorSelection } from "@codemirror/state";

export interface CommentToggleResult {
  text: string;
  selStart: number;
  selEnd: number;
}

/**
 * Exact port of the textarea editor's Ctrl/Cmd+/ behavior. Lines are expanded
 * to whole-line boundaries; when every selected line is commented the markers
 * come off (with at most one space after `//`), otherwise `// ` is prepended
 * after any indentation. Blank and whitespace-only lines are never commented.
 */
export function toggleCommentInText(
  text: string,
  start: number,
  end: number
): CommentToggleResult {
  const beforeSelection = text.substring(0, start);
  const afterSelection = text.substring(end);

  // Find the start of the first line.
  const lineStart = beforeSelection.lastIndexOf("\n") + 1;
  // Find the end of the last line.
  const lineEnd =
    afterSelection.indexOf("\n") === -1
      ? text.length
      : end + afterSelection.indexOf("\n");

  const beforeLines = text.substring(0, lineStart);
  const selectedLines = text.substring(lineStart, lineEnd);
  const afterLines = text.substring(lineEnd);

  const lines = selectedLines.split("\n");
  const allCommented = lines.every((line) => line.trim().startsWith("//"));

  let newLines: string[];
  if (allCommented) {
    newLines = lines.map((line) => {
      const match = line.match(/^(\s*)\/\/\s?(.*)$/);
      return match ? match[1] + match[2] : line;
    });
  } else {
    newLines = lines.map((line) => {
      if (line.trim() === "") return line;
      const match = line.match(/^(\s*)(.*)$/);
      return match ? match[1] + "// " + match[2] : "// " + line;
    });
  }

  const joined = newLines.join("\n");
  return {
    text: beforeLines + joined + afterLines,
    selStart: lineStart,
    selEnd: lineStart + joined.length,
  };
}

/**
 * CodeMirror command form of {@link toggleCommentInText}. Applies one
 * localized change covering exactly the affected lines, so the rest of the
 * document (and its positions) is untouched.
 */
export const toggleCommentCommand: StateCommand = ({ state, dispatch }) => {
  const range = state.selection.main;
  const text = state.doc.toString();
  const result = toggleCommentInText(text, range.from, range.to);

  if (result.text === text) return false;

  // Locate the changed region: the lines covering the original selection.
  const firstLine = state.doc.lineAt(range.from);
  const lastLine = state.doc.lineAt(range.to);
  const regionStart = firstLine.from;
  // The line at `range.to` may extend beyond the line the pure version
  // computes when the selection ends exactly at a line start: both agree that
  // position belongs to the following line, so the regions match.
  const regionEnd = lastLine.to;

  const before = text.substring(0, regionStart);
  const after = text.substring(regionEnd);
  const insert = result.text.slice(before.length, result.text.length - after.length);

  dispatch(
    state.update({
      changes: { from: regionStart, to: regionEnd, insert },
      selection: EditorSelection.range(result.selStart, result.selEnd),
      userEvent: "input.comment",
    })
  );
  return true;
};
