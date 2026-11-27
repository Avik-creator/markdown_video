import type { DirectiveEditResult, DirectiveValueEdit } from "@markdown-video/core";
import { flushPendingEditorText } from "./codemirror/store-sync";
import { useVideoStore } from "@/lib/use-video-store";

/**
 * Editor-facing wrapper around the store's pure directive mutation.
 *
 * CodeMirror typing is committed on a debounce, while panel controls act
 * outside the editor. Flushing first is what makes the operation atomic with
 * respect to typing: the rewrite is computed from the user's latest text, and
 * the pending keystrokes cannot be clobbered by a rewrite based on stale store
 * markdown. Failures are intentionally non-fatal UI events — the markdown is
 * the source of truth and malformed/ambiguous constructs must never be eaten.
 */
export function applyDirectiveEditInEditor(edit: DirectiveValueEdit): DirectiveEditResult {
  flushPendingEditorText();
  const result = useVideoStore.getState().applyDirectiveEdit(edit);
  if (!result.ok) {
    console.warn(`[markdown-video] Directive edit skipped: ${result.reason}`);
  }
  return result;
}
