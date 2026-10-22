import { Emoji } from "../../components/Emoji";
import type { CSSProperties } from "react";
import { FileText, RotateCcw } from "lucide-react";
import type { Category, TrashNote } from "../../api";
import { cn } from "../../lib/cn";
import { Button } from "../../components/Button";
import { relativeDate } from "../../lib/date";
import { cleanSnippet } from "../../lib/text";
import { useNotes } from "../../stores/notes";
import { emptyTrashWithConfirm } from "./actions";

function TrashItem({
  note,
  category,
  selected,
  onSelect,
}: {
  note: TrashNote;
  category: Category | undefined;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <button
      type="button"
      aria-current={selected}
      onClick={() => onSelect(note.id)}
      className={cn(
        "box-border flex w-full flex-none gap-2.5 rounded-lg px-2.5 py-2 outline-none hover:bg-hover focus:bg-hover",
        selected && "bg-hover",
      )}
    >
      <span
        style={category ? ({ "--ch": category.hue } as CSSProperties) : undefined}
        className={cn(
          "flex size-[22px] flex-none items-center justify-center rounded-[7px] text-[13px]",
          category ? "bg-[hsl(var(--ch)_var(--tint-s)_var(--tint-l))]" : "bg-soft text-accent",
        )}
      >
        {category ? <Emoji native={category.emoji} /> : <FileText size={13} aria-hidden="true" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("truncate text-[13px] font-semibold", !note.title && "font-medium text-muted italic")}>
          {note.title || "Sin título"}
        </span>
        <span className="min-h-[1.4em] truncate text-xs text-muted">{cleanSnippet(note.snippet, note.title)}</span>
        <span className="truncate text-[11px] text-muted">
          {category?.name ?? "Sin categoría"} · borrada {relativeDate(note.deletedAt)}
        </span>
      </span>
    </button>
  );
}

export function TrashPanel() {
  const trash = useNotes((s) => s.trash);
  const status = useNotes((s) => s.trashStatus);
  const selectedId = useNotes((s) => s.trashSelectedId);
  const categories = useNotes((s) => s.categories);
  const select = useNotes((s) => s.selectTrash);
  const refresh = useNotes((s) => s.refreshTrash);

  let body;
  if (status === "loading") {
    body = <div className="px-4 py-7 text-center text-[12.5px] text-muted" aria-busy="true">Cargando…</div>;
  } else if (status === "error" && trash.length === 0) {
    body = (
      <div className="px-4 py-7 text-center text-[12.5px] text-muted">
        <span role="alert">No se pudo cargar la papelera.</span>
        <br />
        <Button variant="secondary" size="sm" icon={RotateCcw} className="mt-2" onClick={() => void refresh()}>
          Reintentar
        </Button>
      </div>
    );
  } else if (trash.length === 0) {
    body = (
      <div className="px-4 py-7 text-center text-[12.5px] leading-normal text-muted">
        La papelera está vacía.
        <br />
        Las notas que borres aparecerán aquí.
      </div>
    );
  } else {
    body = trash.map((n) => (
      <TrashItem
        key={n.id}
        note={n}
        category={categories.find((c) => c.id === n.categoryId)}
        selected={n.id === selectedId}
        onSelect={select}
      />
    ));
  }

  return (
    <>
      <div className="box-border flex h-12 flex-none items-center justify-between gap-2 border-b border-line pr-2 pl-3.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-[15px] font-bold whitespace-nowrap">Papelera</span>
          <span className="text-xs whitespace-nowrap text-muted">
            {trash.length} {trash.length === 1 ? "nota" : "notas"}
          </span>
        </div>
        <button
          type="button"
          disabled={trash.length === 0}
          onClick={() => void emptyTrashWithConfirm(trash.length)}
          className="h-[30px] flex-none rounded-lg px-2.5 text-xs font-semibold text-danger enabled:hover:bg-hover disabled:opacity-40"
        >
          Vaciar papelera
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 pt-1.5 pb-2">{body}</div>
    </>
  );
}
