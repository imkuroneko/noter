import { useNotes } from "../../stores/notes";

export function EmptyEditor() {
  const error = useNotes((s) => s.noteError);
  const status = useNotes((s) => s.listStatus);
  const loaded = useNotes((s) => s.listLoaded);
  const hasNotes = useNotes((s) => s.list.length > 0);
  const create = useNotes((s) => s.createNote);

  let content;
  if (error) {
    content = <span role="alert">{error}</span>;
  } else if (!loaded && status === "loading") {
    content = <span aria-busy="true">Cargando…</span>;
  } else if (status === "error" && !loaded) {
    content = <span>No se pudieron cargar tus notas.</span>;
  } else if (!hasNotes) {
    content = (
      <>
        <span>No hay ninguna nota abierta.</span>
        <button
          type="button"
          onClick={() => void create()}
          className="h-8 rounded-lg bg-accent px-3.5 text-xs font-semibold text-onaccent"
        >
          Crear una nota
        </button>
      </>
    );
  } else {
    content = <span>Elige una nota de la lista para empezar.</span>;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[13px] text-muted">{content}</div>
  );
}
