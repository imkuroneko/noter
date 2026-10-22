import { Search } from "lucide-react";
import { useNotes } from "../../stores/notes";
import { useCategoryLabel } from "./useCategoryLabel";

export function SearchBox() {
  const query = useNotes((s) => s.query);
  const setQuery = useNotes((s) => s.setQuery);
  const label = useCategoryLabel();
  return (
    <div className="px-2.5 pt-2.5 pb-1.5">
      <label
        htmlFor="note-search"
        className="box-border flex h-8 items-center gap-2 rounded-lg bg-rail px-2.5 text-muted"
      >
        <Search size={14} strokeWidth={2} aria-hidden="true" />
        <input
          id="note-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) setQuery("");
          }}
          placeholder={`Buscar en ${label}`}
          aria-label="Buscar notas"
          className="min-w-0 flex-1 border-0 bg-transparent text-fg outline-offset-6"
        />
      </label>
    </div>
  );
}
