import type {
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { getCompletions } from "@/lib/editor/completions";

/**
 * Adapter over the editor's existing `getCompletions`. Ordering and filtering
 * are entirely owned by that function, so CM's own filtering is disabled
 * (`filter: false`), and each option applies the item's `insert` text — the
 * same replacement the textarea implementation performed.
 *
 * Because the source reads the document fresh on every query, completion
 * chaining falls out naturally: accepting `type:` inserts text, the plugin
 * re-queries (see `activateOnCompletion`), and the values for that key are
 * offered next — including after deletions and paste-style acceptances.
 */
export function markdownCompletionSource(
  context: CompletionContext
): CompletionResult | null {
  const result = getCompletions(context.state.doc.toString(), context.pos);
  if (!result) return null;

  return {
    from: result.from,
    options: result.items.map((item) => ({
      label: item.label,
      detail: item.detail,
      apply: item.insert,
    })),
    filter: false,
  };
}
