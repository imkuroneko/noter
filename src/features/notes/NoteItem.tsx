import { Emoji } from "../../components/Emoji";
import { memo, type CSSProperties, type MouseEvent } from "react";
import { Check, FileText, Pin } from "lucide-react";
import type { Category, NoteSummary } from "../../api";
import { Marked } from "../../components/Marked";
import { cn } from "../../lib/cn";
import { relativeDate } from "../../lib/date";
import { cleanSnippet } from "../../lib/text";

interface Props {
  note: NoteSummary;
  category: Category | undefined;
  selected: boolean;
  /** Forma parte de una selección múltiple. */
  multi: boolean;
  onSelect: (id: number, mods: { ctrl: boolean; shift: boolean }) => void;
  onContextMenu: (e: MouseEvent, note: NoteSummary) => void;
}

export const NoteItem = memo(function NoteItem({ note, category, selected, multi, onSelect, onContextMenu }: Props) {
  const title = note.titleHl ?? note.title;
  const snippet = cleanSnippet(note.snippet, note.titleHl ? "" : note.title);
  const style = category ? ({ "--ch": category.hue } as CSSProperties) : undefined;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={(e) => onSelect(note.id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
      onContextMenu={(e) => onContextMenu(e, note)}
      // Sin outline: la selección y el foco se indican con el fondo (el outline aparecía al pulsar Shift).
      className={cn(
        "box-border flex w-full flex-none gap-2.5 rounded-lg px-2.5 py-2 outline-none hover:bg-hover focus:bg-hover",
        selected && (multi ? "bg-soft" : "bg-hover"),
      )}
    >
      <span
        style={style}
        className={cn(
          "flex size-[22px] flex-none items-center justify-center rounded-[7px] text-[13px]",
          category ? "bg-[hsl(var(--ch)_var(--tint-s)_var(--tint-l))]" : "bg-soft text-accent",
        )}
      >
        {category ? <Emoji native={category.emoji} /> : <FileText size={13} aria-hidden="true" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className={cn("truncate text-[13px] font-semibold", !title && "font-medium text-muted italic")}>
            {title ? <Marked text={title} /> : "Sin título"}
          </span>
          {multi && <Check size={12} strokeWidth={3} aria-hidden="true" className="flex-none text-accent" />}
          {note.pinned && <Pin size={11} aria-label="Fijada" className="flex-none text-accent" />}
        </span>
        <span className="min-h-[1.4em] truncate text-xs text-muted">
          <Marked text={snippet} />
        </span>
        <span className="flex justify-between gap-2 text-[11px] text-muted">
          <span className="truncate">{note.tags.map((t) => `#${t}`).join(" ")}</span>
          <span className="flex-none">{relativeDate(note.updatedAt)}</span>
        </span>
      </span>
    </button>
  );
});
