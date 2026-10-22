import { useCallback, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { NoteSummary } from "../../api";
import { arrowNav } from "../../lib/useDismiss";
import { useMenu } from "../../stores/menu";
import { useNotes } from "../../stores/notes";
import { noteMenuItems } from "../menus/menuItems";
import { trashManyWithConfirm, trashNoteWithConfirm } from "./actions";
import { NoteItem } from "./NoteItem";

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando notas" className="flex flex-col gap-2 px-2.5 py-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex animate-pulse gap-2.5">
          <div className="size-[22px] rounded-[7px] bg-hover" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3 w-3/4 rounded bg-hover" />
            <div className="h-2.5 w-full rounded bg-hover" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Message({ children }: { children: ReactNode }) {
  return <div className="px-4 py-7 text-center text-[12.5px] leading-normal text-muted">{children}</div>;
}

export function NoteList() {
  const list = useNotes((s) => s.list);
  const status = useNotes((s) => s.listStatus);
  const loaded = useNotes((s) => s.listLoaded);
  const error = useNotes((s) => s.listError);
  const categories = useNotes((s) => s.categories);
  const currentId = useNotes((s) => s.currentNote?.id);
  const hasTags = useNotes((s) => s.selectedTagIds.length > 0);
  const query = useNotes((s) => s.query.trim());
  const init = useNotes((s) => s.init);
  const refresh = useNotes((s) => s.refreshList);
  const create = useNotes((s) => s.createNote);
  const onSelect = useNotes((s) => s.clickNote);
  const multi = useNotes((s) => s.multiIds);
  const openMenu = useMenu((s) => s.open);

  const onContextMenu = useCallback(
    (e: MouseEvent, note: NoteSummary) => {
      e.preventDefault();
      const s = useNotes.getState();
      // Sobre una nota dentro de la selección múltiple, el menú actúa sobre todas.
      let targets = [note];
      if (s.multiIds.includes(note.id)) targets = s.list.filter((n) => s.multiIds.includes(n.id));
      else s.clickNote(note.id, { ctrl: false, shift: false });
      openMenu({
        x: e.clientX,
        y: e.clientY,
        label: targets.length > 1 ? `Acciones de ${targets.length} notas` : "Acciones de la nota",
        items: noteMenuItems(targets, s.categories),
      });
    },
    [openMenu],
  );

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const s = useNotes.getState();
    if (e.key === "Escape" && s.multiIds.length > 0) {
      e.preventDefault();
      s.clearMulti();
    } else if (e.key === "Delete") {
      e.preventDefault();
      if (s.multiIds.length >= 2) void trashManyWithConfirm(s.multiIds);
      else if (s.currentNote) void trashNoteWithConfirm(s.currentNote.id, s.title);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      s.selectAllVisible();
    } else {
      arrowNav(e, "[role='option']");
    }
  };

  const retry = (
    <button
      type="button"
      onClick={() => void (loaded ? refresh() : init())}
      className="mt-2 h-8 rounded-lg bg-rail px-3 text-xs font-semibold hover:bg-hover"
    >
      Reintentar
    </button>
  );

  let body: ReactNode;
  if (status === "loading" && !loaded) {
    body = <Skeleton />;
  } else if (status === "error" && list.length === 0) {
    body = (
      <Message>
        <span role="alert">{error ?? "No se pudieron cargar las notas."}</span>
        <br />
        {retry}
      </Message>
    );
  } else if (list.length === 0 && (hasTags || query)) {
    body = query ? (
      <Message>
        No hay resultados para “{query}”.
        <br />
        Prueba con otras palabras.
      </Message>
    ) : (
      <Message>
        Ninguna nota coincide con esos filtros.
        <br />
        Quita una etiqueta para ver más.
      </Message>
    );
  } else if (list.length === 0) {
    body = (
      <Message>
        Todavía no hay notas aquí.
        <br />
        <button
          type="button"
          onClick={() => void create()}
          className="mt-2 h-8 rounded-lg bg-accent px-3 text-xs font-semibold text-onaccent"
        >
          Crear una nota
        </button>
      </Message>
    );
  } else {
    body = (
      <>
        {status === "error" && (
          <div role="alert" className="mb-1 rounded-lg bg-soft px-2.5 py-1.5 text-xs text-accent">
            No se pudo actualizar la lista.{" "}
            <button type="button" onClick={() => void refresh()} className="font-semibold underline">
              Reintentar
            </button>
          </div>
        )}
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="Notas"
          onKeyDown={onListKey}
          className="flex flex-col gap-0.5"
        >
          {list.map((n) => (
            <NoteItem
              key={n.id}
              note={n}
              category={categories.find((c) => c.id === n.categoryId)}
              selected={multi.length >= 2 ? multi.includes(n.id) : n.id === currentId}
              multi={multi.length >= 2 && multi.includes(n.id)}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-line px-1.5 pt-1.5 pb-2">
      {body}
      <div aria-live="polite" className="sr-only">
        {multi.length >= 2 ? `${multi.length} notas seleccionadas` : ""}
      </div>
    </div>
  );
}
