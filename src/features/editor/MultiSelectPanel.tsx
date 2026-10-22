import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useNotes } from "../../stores/notes";
import { trashManyWithConfirm } from "../notes/actions";

/** Panel derecho cuando hay 2 o más notas seleccionadas en la lista. */
export function MultiSelectPanel() {
  const ids = useNotes((s) => s.multiIds);
  const clear = useNotes((s) => s.clearMulti);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [clear]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div>
        <p className="text-lg font-bold">{ids.length} notas seleccionadas</p>
        <p className="mt-1 text-[13px] text-muted">
          Ctrl+clic suma o quita una nota; Shift+clic elige un rango. Pulsa Escape para cancelar.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void trashManyWithConfirm(ids)}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-danger px-3.5 text-[12.5px] font-semibold text-ondanger"
        >
          <Trash2 size={14} aria-hidden="true" />
          Mover a la papelera
        </button>
        <button
          type="button"
          onClick={clear}
          className="h-8 rounded-lg bg-rail px-3.5 text-[12.5px] font-semibold hover:bg-hover"
        >
          Cancelar selección
        </button>
      </div>
    </div>
  );
}
