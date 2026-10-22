import { useNotes } from "../../stores/notes";
import { useUi } from "../../stores/ui";
import { TrashPreview } from "./TrashPreview";
import { EditorTopBar } from "./EditorTopBar";
import { EmptyEditor } from "./EmptyEditor";
import { MultiSelectPanel } from "./MultiSelectPanel";
import { NoteTagsRow } from "./NoteTagsRow";
import { Preview } from "./Preview";
import { SourceEditor } from "./SourceEditor";
import { StatusBar } from "./StatusBar";

export function EditorPane() {
  const noteId = useNotes((s) => s.currentNote?.id);
  const noteError = useNotes((s) => s.noteError);
  const mode = useUi((s) => s.mode);
  const trashMode = useNotes((s) => s.trashMode);
  const multiCount = useNotes((s) => s.multiIds.length);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-main">
      {trashMode ? (
        <TrashPreview />
      ) : multiCount >= 2 ? (
        <MultiSelectPanel />
      ) : noteId === undefined ? (
        <EmptyEditor />
      ) : (
        <>
          <EditorTopBar />
          <NoteTagsRow />
          {noteError && (
            <div role="alert" className="flex-none bg-soft px-5 py-1.5 text-xs text-accent">
              No se pudo abrir esa nota: {noteError}
            </div>
          )}
          <div className="flex min-h-0 flex-1">
            {mode !== "view" && <SourceEditor key={noteId} bordered={mode === "split"} />}
            {mode !== "edit" && <Preview />}
          </div>
          <StatusBar />
        </>
      )}
    </main>
  );
}
