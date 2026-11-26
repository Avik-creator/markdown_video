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
    caretColor: "#ec4899",
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
      "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
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
  --cm-md-text: #171717;
  --cm-md-gutter-bg: #f9fafb;
  --cm-md-gutter-border: #e5e7eb;
  --cm-md-gutter-text: #9ca3af;
  --cm-md-highlight-bg: rgb(236 72 153 / 0.15);
  --cm-md-highlight-border: #ec4899;
  --cm-md-highlight-text: #ec4899;
  --cm-md-error: #ef4444;
  --cm-md-error-bg: rgb(239 68 68 / 0.1);
  --cm-md-error-text: #dc2626;
  --cm-md-warning: #f59e0b;
  --cm-md-warning-bg: rgb(245 158 11 / 0.1);
  --cm-md-warning-text: #d97706;
  --cm-md-tooltip-bg: #ffffff;
  --cm-md-tooltip-border: #e5e7eb;
  --cm-md-tooltip-selected: rgb(236 72 153 / 0.12);
  --cm-md-tooltip-detail: #6b7280;
  --cm-md-syntax-heading: #be185d;
  --cm-md-syntax-code: #0f766e;
  --cm-md-syntax-link: #2563eb;
  --cm-md-syntax-quote: #16a34a;
  --cm-md-syntax-comment: #16a34a;
  --cm-md-syntax-keyword: #7c3aed;
  --cm-md-syntax-string: #b45309;
  --cm-md-syntax-number: #0369a1;
  --cm-md-syntax-property: #0e7490;
}
.dark .cm-md-editor-host {
  --cm-md-text: #f5f5f5;
  --cm-md-gutter-bg: #171717;
  --cm-md-gutter-border: #262626;
  --cm-md-gutter-text: #525252;
  --cm-md-highlight-bg: rgb(236 72 153 / 0.2);
  --cm-md-highlight-border: #ec4899;
  --cm-md-highlight-text: #f472b6;
  --cm-md-error: #ef4444;
  --cm-md-error-bg: rgb(239 68 68 / 0.12);
  --cm-md-error-text: #f87171;
  --cm-md-warning: #f59e0b;
  --cm-md-warning-bg: rgb(245 158 11 / 0.12);
  --cm-md-warning-text: #fbbf24;
  --cm-md-tooltip-bg: #171717;
  --cm-md-tooltip-border: #404040;
  --cm-md-tooltip-selected: rgb(236 72 153 / 0.25);
  --cm-md-tooltip-detail: #737373;
  --cm-md-syntax-heading: #f472b6;
  --cm-md-syntax-code: #5eead4;
  --cm-md-syntax-link: #93c5fd;
  --cm-md-syntax-quote: #86efac;
  --cm-md-syntax-comment: #86efac;
  --cm-md-syntax-keyword: #c4b5fd;
  --cm-md-syntax-string: #fcd34d;
  --cm-md-syntax-number: #7dd3fc;
  --cm-md-syntax-property: #67e8f9;
}
`;
