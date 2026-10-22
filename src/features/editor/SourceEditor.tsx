import { useEffect, useRef } from "react";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { Annotation, EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, placeholder } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { cn } from "../../lib/cn";
import { useNotes } from "../../stores/notes";
import { useUi } from "../../stores/ui";
import { noterTheme } from "./cmTheme";

// Marca los cambios que vienen del store (casillas de la vista previa) para no devolverlos.
const external = Annotation.define<boolean>();

/** Reemplaza solo el tramo que cambió, para conservar el cursor y el scroll. */
function minimalChange(prev: string, next: string) {
  let start = 0;
  const max = Math.min(prev.length, next.length);
  while (start < max && prev.charCodeAt(start) === next.charCodeAt(start)) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev.charCodeAt(endPrev - 1) === next.charCodeAt(endNext - 1)) {
    endPrev--;
    endNext--;
  }
  return { from: start, to: endPrev, insert: next.slice(start, endNext) };
}

/** Editor CodeMirror de la nota actual. Se monta con `key={id}`, así cada nota arranca limpia. */
export function SourceEditor({ bordered }: { bordered: boolean }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: useNotes.getState().body,
        extensions: [
          minimalSetup,
          lineNumbers(),
          EditorView.lineWrapping,
          markdown({ codeLanguages: languages }),
          noterTheme,
          placeholder("# Título\n\nEscribe aquí tu nota en Markdown…"),
          EditorView.contentAttributes.of({ "aria-label": "Contenido de la nota", lang: "es" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !u.transactions.some((tr) => tr.annotation(external))) {
              useNotes.getState().setBody(u.state.doc.toString());
            }
          }),
        ],
      }),
    });

    const unsubscribe = useNotes.subscribe((state, prev) => {
      if (state.body === prev.body) return;
      const current = view.state.doc.toString();
      if (current === state.body) return;
      view.dispatch({ changes: minimalChange(current, state.body), annotations: external.of(true) });
    });

    // Se consume en el siguiente tick para que también funcione con el doble montaje de StrictMode.
    if (useUi.getState().pendingFocus) {
      view.focus();
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      window.setTimeout(() => useUi.getState().consumeEditorFocus(), 0);
    }

    return () => {
      unsubscribe();
      view.destroy();
    };
  }, []);

  return (
    <div ref={host} className={cn("min-h-0 min-w-0 flex-1 overflow-hidden", bordered && "border-r border-line")} />
  );
}
