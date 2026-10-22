import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// Todo sale de las variables CSS del tema, así que cambia solo con claro/oscuro y paleta.
const theme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "var(--text)",
    fontSize: "12.5px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    lineHeight: "20px",
  },
  ".cm-content": { caretColor: "var(--accent)", padding: "18px 0" },
  ".cm-line": { padding: "0 20px 0 6px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
  ".cm-selectionBackground, .cm-content ::selection": { backgroundColor: "var(--soft)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--soft)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--muted)",
    border: "none",
    fontSize: "11px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minWidth: "44px",
    padding: "0 14px 0 0",
    opacity: "0.8",
    fontVariantNumeric: "tabular-nums",
  },
  ".cm-placeholder": { color: "var(--muted)" },
});

const highlight = HighlightStyle.define([
  { tag: t.heading, color: "var(--accent)" },
  { tag: t.quote, color: "var(--muted)" },
  { tag: [t.processingInstruction, t.contentSeparator, t.meta], color: "var(--muted)" },
  { tag: t.strong, fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.link, t.url], color: "var(--accent)" },
  { tag: t.keyword, color: "var(--accent)" },
  { tag: [t.string, t.regexp], color: "var(--hl-str)" },
  { tag: [t.number, t.bool, t.null], color: "var(--hl-num)" },
  { tag: [t.function(t.variableName), t.typeName, t.className], color: "var(--hl-fn)" },
  { tag: t.comment, color: "var(--muted)", fontStyle: "italic" },
]);

export const noterTheme = [theme, syntaxHighlighting(highlight)];
