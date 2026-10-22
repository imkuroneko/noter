import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { fullDate, relativeDate } from "../../lib/date";
import { useNotes } from "../../stores/notes";

const normalize = (raw: string) => raw.trim().replace(/^#+/, "").trim().toLowerCase();

export function NoteTagsRow() {
  const note = useNotes((s) => s.currentNote);
  const setTags = useNotes((s) => s.setNoteTags);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  if (!note) return null;
  const tags = note.tags;

  const commit = (): boolean => {
    const names = draft.split(",").map(normalize).filter((n) => n && !tags.includes(n));
    setDraft("");
    if (names.length === 0) return false;
    void setTags([...tags, ...new Set(names)]);
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!commit() && draft.trim() === "") setAdding(false);
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      void setTags(tags.slice(0, -1));
    } else if (e.key === "Escape") {
      setDraft("");
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-none flex-wrap items-center gap-1.5 border-b border-line px-5 py-2.5">
      {tags.map((t) => (
        <span
          key={t}
          className="flex h-[22px] items-center gap-1 rounded-[11px] bg-soft pr-1 pl-[9px] text-xs font-medium text-accent"
        >
          #{t}
          <button
            type="button"
            aria-label={`Quitar etiqueta ${t}`}
            title={`Quitar etiqueta ${t}`}
            onClick={() => void setTags(tags.filter((x) => x !== t))}
            className="flex size-4 items-center justify-center rounded-full hover:bg-hover"
          >
            <X size={11} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          aria-label="Nueva etiqueta"
          value={draft}
          placeholder="etiqueta"
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            commit();
            setAdding(false);
          }}
          className="box-border h-[22px] w-28 rounded-[11px] border border-accent bg-transparent px-[9px] text-xs text-fg"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-[22px] items-center rounded-[11px] border border-dashed border-line px-[9px] text-xs text-muted hover:bg-hover"
        >
          + etiqueta
        </button>
      )}
      <span className="ml-auto text-xs text-muted" title={fullDate(note.updatedAt)}>
        Editada {relativeDate(note.updatedAt)}
      </span>
    </div>
  );
}
