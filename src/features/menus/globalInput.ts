import { EditorView } from "@codemirror/view";
import type { MenuItem } from "../../stores/menu";
import { useMenu } from "../../stores/menu";
import { useUi } from "../../stores/ui";

const FIELD = "input, textarea";
const SELECTABLE = "[data-selectable]";

function selectContents(el: Element) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

async function pasteText(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    useUi.getState().showNotice("No se pudo leer el portapapeles. Pega con Ctrl+V.");
    return null;
  }
}

function editorItems(view: EditorView): MenuItem[] {
  const empty = view.state.selection.main.empty;
  return [
    {
      id: "cut",
      label: "Cortar",
      disabled: empty,
      onSelect: () => {
        view.focus();
        document.execCommand("cut");
      },
    },
    {
      id: "copy",
      label: "Copiar",
      disabled: empty,
      onSelect: () => {
        view.focus();
        document.execCommand("copy");
      },
    },
    {
      id: "paste",
      label: "Pegar",
      onSelect: () => {
        void pasteText().then((text) => {
          if (text === null) return;
          view.dispatch(view.state.replaceSelection(text));
          view.focus();
        });
      },
    },
    {
      id: "all",
      label: "Seleccionar todo",
      separatorBefore: true,
      onSelect: () => {
        view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
        view.focus();
      },
    },
  ];
}

function fieldItems(field: HTMLInputElement | HTMLTextAreaElement): MenuItem[] {
  const empty = field.selectionStart === field.selectionEnd;
  return [
    {
      id: "cut",
      label: "Cortar",
      disabled: empty || field.readOnly,
      onSelect: () => {
        field.focus();
        document.execCommand("cut");
      },
    },
    {
      id: "copy",
      label: "Copiar",
      disabled: empty,
      onSelect: () => {
        field.focus();
        document.execCommand("copy");
      },
    },
    {
      id: "paste",
      label: "Pegar",
      disabled: field.readOnly,
      onSelect: () => {
        void pasteText().then((text) => {
          if (text === null) return;
          field.focus();
          document.execCommand("insertText", false, text);
        });
      },
    },
    {
      id: "all",
      label: "Seleccionar todo",
      separatorBefore: true,
      onSelect: () => {
        field.focus();
        field.select();
      },
    },
  ];
}

function previewItems(region: Element): MenuItem[] {
  const text = window.getSelection()?.toString() ?? "";
  return [
    {
      id: "copy",
      label: "Copiar",
      disabled: text === "",
      onSelect: () => {
        if (!document.execCommand("copy")) void navigator.clipboard.writeText(text).catch(() => undefined);
      },
    },
    {
      id: "all",
      label: "Seleccionar todo",
      onSelect: () => selectContents(region),
    },
  ];
}

function textItems(target: Element): MenuItem[] | null {
  const editor = target.closest<HTMLElement>(".cm-editor");
  if (editor) {
    const view = EditorView.findFromDOM(editor);
    return view ? editorItems(view) : null;
  }
  const field = target.closest<HTMLInputElement | HTMLTextAreaElement>(FIELD);
  if (field && !(field instanceof HTMLInputElement && !/^(text|search|)$/.test(field.type))) {
    return fieldItems(field);
  }
  const region = target.closest(SELECTABLE);
  return region ? previewItems(region) : null;
}

/**
 * Entrada global: sin menú contextual nativo (trae "Compartir"), menú propio de edición
 * en editor, vista previa y campos, y Ctrl+A limitado a la zona que corresponde.
 */
export function installGlobalInput(): () => void {
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const target = e.target instanceof Element ? e.target : null;
    if (!target || target.closest("[role='menu']")) return;
    const items = textItems(target);
    if (items) useMenu.getState().open({ x: e.clientX, y: e.clientY, label: "Edición", items });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "a") return;
    const target = e.target instanceof Element ? e.target : null;
    // Los campos, el editor y el selector de emoji ya seleccionan solo lo suyo.
    if (target?.closest(`${FIELD}, .cm-editor, em-emoji-picker`)) return;
    e.preventDefault();
    const active = document.activeElement instanceof Element ? document.activeElement : null;
    const region = active?.closest(SELECTABLE);
    if (region) selectContents(region);
  };

  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("contextmenu", onContextMenu);
    document.removeEventListener("keydown", onKeyDown);
  };
}
