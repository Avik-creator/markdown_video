import { EditorState, Prec, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  placeholder,
  type ViewUpdate,
} from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { acceptCompletion, autocompletion } from "@codemirror/autocomplete";
import { lintGutter } from "@codemirror/lint";
import { markdown } from "@codemirror/lang-markdown";
import { toggleCommentCommand } from "./comments";
import { markdownCompletionSource } from "./completion-source";
import { editorMarkersField } from "./line-marks";
import { markdownEditorTheme, markdownSyntaxHighlighting } from "./theme";

export interface CreateEditorExtensionsOptions {
  /** Receives every view update; wire it to the store sync bridge. */
  onUpdate: (update: ViewUpdate) => void;
  /** Mousedown inside the editable content, before CM handles it. */
  onEditorMouseDown?: () => void;
  /** The editable content losing focus. */
  onEditorBlur?: () => void;
}

/**
 * The editor's CodeMirror configuration. Deliberately conservative:
 *
 * - No `history`/`historyKeymap`: undo/redo stays authoritative in the
 *   Zustand store (whole-document granularity), so CM's own history must not
 *   compete with it.
 * - Markdown language without its keymap (no list continuation), without
 *   HTML tag completion and without paste-URL-as-link rewriting.
 * - No line wrapping: long lines scroll horizontally, as before.
 * - `Tab` accepts an open completion but falls through to native focus
 *   movement when the popup is closed, because `acceptCompletion` returns
 *   false without an active selection.
 * - `Mod-/` toggles `//` comments with the exact pre-migration semantics,
 *   taking precedence over `defaultKeymap`'s language-aware (and here
 *   useless) comment command.
 */
export function createEditorExtensions(
  options: CreateEditorExtensionsOptions
): Extension[] {
  return [
    lineNumbers(),
    lintGutter(),
    editorMarkersField,
    markdown({
      addKeymap: false,
      completeHTMLTags: false,
      pasteURLAsLink: false,
    }),
    autocompletion({
      override: [markdownCompletionSource],
      // Accepting a completion re-queries immediately, which is what chains
      // "type:" into its value list without an extra keystroke.
      activateOnCompletion: () => true,
      activateOnTypingDelay: 0,
      // The pre-migration popup accepted Enter/Tab as soon as it was open,
      // with no grace period.
      interactionDelay: 0,
      closeOnBlur: true,
      icons: false,
    }),
    Prec.high(
      keymap.of([
        { key: "Mod-/", run: toggleCommentCommand },
        { key: "Tab", run: acceptCompletion },
      ])
    ),
    keymap.of([...defaultKeymap]),
    EditorState.tabSize.of(2),
    EditorView.contentAttributes.of({
      spellcheck: "false",
      "aria-label": "Scene markdown",
    }),
    placeholder("Enter your scene markdown..."),
    markdownEditorTheme,
    markdownSyntaxHighlighting,
    EditorView.updateListener.of((update) => options.onUpdate(update)),
    EditorView.domEventHandlers({
      mousedown: () => {
        options.onEditorMouseDown?.();
      },
      blur: () => {
        options.onEditorBlur?.();
      },
    }),
  ];
}
