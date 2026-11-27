import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * Visual theme reproducing the textarea editor's design: 14px monospace text
 * on 20px lines, 12px padding, a pink caret, a muted line-number gutter with
 * a separating border, and the highlight/problem line treatments that the
 * manual overlays used to paint. Colors go through CSS variables so the same
 * editor instance follows the app's light/dark mode without reconfiguration.
 */
export const markdownEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    backgroundColor: "transparent",
    color: "var(--cm-md-text)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "20px",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "12px",
    caretColor: "var(--accent)",
  },
  ".cm-line": {
    padding: "0",
    lineHeight: "20px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-gutters": {
    backgroundColor: "var(--cm-md-gutter-bg)",
    color: "var(--cm-md-gutter-text)",
    border: "none",
    borderRight: "1px solid var(--cm-md-gutter-border)",
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 4px",
    minWidth: "32px",
    textAlign: "right",
    lineHeight: "20px",
  },
  ".cm-lintRange-error": {
    textDecoration: "underline wavy var(--cm-md-error) 1px",
    textUnderlineOffset: "3px",
  },
  ".cm-lintRange-warning": {
    textDecoration: "underline wavy var(--cm-md-warning) 1px",
    textUnderlineOffset: "3px",
  },

  // --- Source-range highlight and problem line decorations ---
  ".cm-md-highlight-line": {
    backgroundColor: "var(--cm-md-highlight-bg)",
    borderLeft: "2px solid var(--cm-md-highlight-border)",
    marginLeft: "-12px",
    paddingLeft: "10px",
  },
  ".cm-md-highlight-first": {
    borderTopLeftRadius: "6px",
    borderTopRightRadius: "6px",
  },
  ".cm-md-highlight-last": {
    borderBottomLeftRadius: "6px",
    borderBottomRightRadius: "6px",
  },
  ".cm-md-error-line": {
    backgroundColor: "var(--cm-md-error-bg)",
    borderLeft: "2px solid var(--cm-md-error)",
    marginLeft: "-12px",
    paddingLeft: "10px",
  },
  ".cm-md-warning-line": {
    backgroundColor: "var(--cm-md-warning-bg)",
    borderLeft: "2px solid var(--cm-md-warning)",
    marginLeft: "-12px",
    paddingLeft: "10px",
  },

  // --- Gutter row colors (numbers inherit them) ---
  ".cm-md-highlight-gutter": {
    color: "var(--cm-md-highlight-text)",
    fontWeight: "600",
  },
  ".cm-md-error-gutter": {
    color: "var(--cm-md-error-text)",
    fontWeight: "600",
  },
  ".cm-md-warning-gutter": {
    color: "var(--cm-md-warning-text)",
    fontWeight: "600",
  },

  // --- Completion tooltip ---
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "var(--cm-md-tooltip-bg)",
    border: "1px solid var(--cm-md-tooltip-border)",
    borderRadius: "6px",
    boxShadow:
      "0 1px 2px var(--shadow)",
    fontSize: "12px",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete ul": {
    fontFamily: "var(--font-mono)",
    maxHeight: "224px",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "4px 8px",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--cm-md-tooltip-selected)",
    color: "var(--cm-md-text)",
  },
  ".cm-completionDetail": {
    color: "var(--cm-md-tooltip-detail)",
    fontStyle: "normal",
    marginLeft: "0.8em",
  },

  // --- Lint gutter ---
  ".cm-gutter-lint": {
    width: "0.9em",
  },
  ".cm-lint-marker": {
    width: "0.55em",
    height: "0.55em",
  },

  // --- Placeholder ---
  ".cm-placeholder": {
    color: "var(--cm-md-gutter-text)",
  },
});

/**
 * Small syntax highlight style using mode-aware variables. The document is a
 * markdown-ish directive format, so this mostly accents headings, code fences
 * and emphasis rather than full language grammar.
 */
const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--cm-md-syntax-heading)", fontWeight: "600" },
  { tag: tags.monospace, color: "var(--cm-md-syntax-code)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.link, color: "var(--cm-md-syntax-link)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--cm-md-syntax-link)" },
  { tag: tags.quote, color: "var(--cm-md-syntax-quote)" },
  { tag: tags.comment, color: "var(--cm-md-syntax-comment)" },
  { tag: tags.processingInstruction, color: "var(--cm-md-syntax-keyword)" },
  { tag: tags.keyword, color: "var(--cm-md-syntax-keyword)" },
  { tag: tags.string, color: "var(--cm-md-syntax-string)" },
  { tag: tags.number, color: "var(--cm-md-syntax-number)" },
  { tag: tags.propertyName, color: "var(--cm-md-syntax-property)" },
  { tag: tags.atom, color: "var(--cm-md-syntax-number)" },
]);

export const markdownSyntaxHighlighting = syntaxHighlighting(markdownHighlightStyle);

/**
 * CSS variable definitions for light mode with `.dark` overrides, scoped to
 * the editor mount so nothing leaks into the rest of the app. Rendered once
 * by the editor component through a plain `<style>` tag.
 */
export const MARKDOWN_EDITOR_CSS_VARS = `
.cm-md-editor-host {
  --cm-md-text: var(--foreground);
  --cm-md-gutter-bg: var(--inset);
  --cm-md-gutter-border: var(--hairline);
  --cm-md-gutter-text: var(--muted-foreground);
  --cm-md-highlight-bg: var(--accent-soft);
  --cm-md-highlight-border: var(--accent);
  --cm-md-highlight-text: var(--accent);
  --cm-md-error: var(--destructive);
  --cm-md-error-bg: var(--destructive-soft);
  --cm-md-error-text: var(--destructive);
  --cm-md-warning: var(--warning);
  --cm-md-warning-bg: var(--warning-soft);
  --cm-md-warning-text: var(--warning);
  --cm-md-tooltip-bg: var(--popover);
  --cm-md-tooltip-border: var(--border);
  --cm-md-tooltip-selected: var(--accent-soft);
  --cm-md-tooltip-detail: var(--muted-foreground);
  --cm-md-syntax-heading: var(--accent-deep);
  --cm-md-syntax-code: var(--info);
  --cm-md-syntax-link: var(--mark-ink);
  --cm-md-syntax-quote: var(--muted-foreground);
  --cm-md-syntax-comment: var(--muted-foreground);
  --cm-md-syntax-keyword: var(--accent);
  --cm-md-syntax-string: var(--mark-ink);
  --cm-md-syntax-number: var(--info);
  --cm-md-syntax-property: var(--foreground);
}
.dark .cm-md-editor-host {
  --cm-md-syntax-heading: var(--accent-deep);
}
`;
