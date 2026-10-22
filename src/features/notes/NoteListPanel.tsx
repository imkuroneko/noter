import { useNotes } from "../../stores/notes";
import { VaultPanel } from "../vault/VaultPanel";
import { NoteList } from "./NoteList";
import { NoteListHeader } from "./NoteListHeader";
import { SearchBox } from "./SearchBox";
import { TagFilter } from "./TagFilter";
import { TrashPanel } from "./TrashPanel";

export function NoteListPanel() {
  const trashMode = useNotes((s) => s.trashMode);
  return (
    <section aria-label="Notas" className="flex min-h-0 w-[264px] flex-none flex-col bg-side">
      {trashMode ? (
        <TrashPanel />
      ) : (
        <>
          <NoteListHeader />
          <SearchBox />
          <TagFilter />
          <NoteList />
        </>
      )}
      <VaultPanel />
    </section>
  );
}
