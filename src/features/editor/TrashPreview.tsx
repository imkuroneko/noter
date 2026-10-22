import { Emoji } from "../../components/Emoji";
import { FileText, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { fullDate, relativeDate } from "../../lib/date";
import { useNotes } from "../../stores/notes";
import { purgeNoteWithConfirm } from "../notes/actions";
import { MarkdownView } from "./Preview";

/** Nota de la papelera en solo lectura. Muestra el extracto que entrega trash_list. */
export function TrashPreview() {
  const note = useNotes((s) => s.trash.find((n) => n.id === s.trashSelectedId));
  const category = useNotes((s) => s.categories.find((c) => c.id === note?.categoryId));
  const restore = useNotes((s) => s.restoreNote);
  const isEmpty = useNotes((s) => s.trash.length === 0);

  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted">
        {isEmpty ? "La papelera está vacía." : "Elige una nota para verla."}
      </div>
    );
  }
  return (
    <>
      <div className="box-border flex h-12 flex-none items-center justify-between gap-3 border-b border-line pr-3.5 pl-5">
        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="flex-none text-[15px]">
            {category ? <Emoji native={category.emoji} /> : <FileText size={15} aria-hidden="true" />}
          </span>
          <span className="whitespace-nowrap text-muted">{category?.name ?? "Sin categoría"}</span>
          <span className="text-muted">/</span>
          <span className={cn("truncate font-semibold", !note.title && "font-medium text-muted italic")}>
            {note.title || "Sin título"}
          </span>
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={() => void restore(note.id)}
            className="flex h-[30px] items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-onaccent"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Restaurar
          </button>
          <button
            type="button"
            onClick={() => void purgeNoteWithConfirm(note.id, note.title)}
            className="flex h-[30px] items-center gap-1.5 rounded-lg border border-danger px-3 text-xs font-semibold text-danger hover:bg-hover"
          >
            <Trash2 size={14} aria-hidden="true" />
            Eliminar definitivamente
          </button>
        </div>
      </div>
      <div className="flex-none border-b border-line px-5 py-2 text-xs text-muted" title={fullDate(note.deletedAt)}>
        En la papelera · borrada {relativeDate(note.deletedAt)} · solo lectura. Se muestra el inicio de la nota.
      </div>
      <article aria-label="Contenido de la nota borrada" data-selectable tabIndex={-1} className="min-w-0 flex-1 overflow-auto px-7 pt-[22px] pb-7">
        <div className="max-w-[620px]">
          {note.snippet.trim() === "" ? (
            <p className="text-[13px] text-muted">Esta nota no tiene contenido.</p>
          ) : (
            <MarkdownView text={note.snippet} />
          )}
        </div>
      </article>
    </>
  );
}
