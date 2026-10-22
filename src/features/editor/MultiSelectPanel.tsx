import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "../../components/Button";
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
        <Button variant="danger" size="sm" icon={Trash2} onClick={() => void trashManyWithConfirm(ids)}>
          Mover a la papelera
        </Button>
        <Button variant="secondary" size="sm" onClick={clear}>
          Cancelar selección
        </Button>
      </div>
    </div>
  );
}
