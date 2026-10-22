import { Emoji } from "../../components/Emoji";
import { FileText, Pin, PinOff, Trash2 } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { cn } from "../../lib/cn";
import { useNotes } from "../../stores/notes";
import { trashNoteWithConfirm } from "../notes/actions";
import { ModeSwitch } from "./ModeSwitch";

export function EditorTopBar() {
  const note = useNotes((s) => s.currentNote);
  const title = useNotes((s) => s.title);
  const category = useNotes((s) => s.categories.find((c) => c.id === s.currentNote?.categoryId));
  const setPinned = useNotes((s) => s.setPinned);
  if (!note) return null;
  return (
    <div className="box-border flex h-12 flex-none items-center justify-between gap-3 border-b border-line pr-3.5 pl-5">
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <span className="flex-none text-[15px]">
          {category ? <Emoji native={category.emoji} /> : <FileText size={15} aria-hidden="true" />}
        </span>
        <span className="whitespace-nowrap text-muted">{category?.name ?? "Sin categoría"}</span>
        <span className="text-muted">/</span>
        <span className={cn("truncate font-semibold", !title && "font-medium text-muted italic")}>
          {title || "Sin título"}
        </span>
      </div>
      <div className="flex flex-none items-center gap-2">
        <IconButton
          label={note.pinned ? "Desfijar nota" : "Fijar nota"}
          aria-pressed={note.pinned}
          onClick={() => void setPinned(note.id, !note.pinned)}
          className={cn(note.pinned && "text-accent")}
        >
          {note.pinned ? <PinOff size={16} aria-hidden="true" /> : <Pin size={16} aria-hidden="true" />}
        </IconButton>
        <IconButton label="Mover a la papelera" onClick={() => void trashNoteWithConfirm(note.id, title)}>
          <Trash2 size={16} aria-hidden="true" />
        </IconButton>
        <ModeSwitch />
      </div>
    </div>
  );
}
