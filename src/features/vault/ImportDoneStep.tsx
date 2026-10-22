import { CheckCircle2, CopyMinus, FolderPlus, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as api from "../../api";
import { Button } from "../../components/Button";
import { plural } from "../../lib/plural";

function Line({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px]">
      <Icon size={16} strokeWidth={1.8} aria-hidden="true" className="flex-none text-accent" />
      {text}
    </li>
  );
}

/** Paso 3: resumen de lo importado. */
export function ImportDoneStep({ result, onClose }: { result: api.ImportResult; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2.5" aria-live="polite">
        <Line icon={CheckCircle2} text={`Se importaron ${plural(result.imported, "nota", "notas")}`} />
        {result.skippedDuplicates > 0 && (
          <Line icon={CopyMinus} text={`Se omitieron ${plural(result.skippedDuplicates, "repetida", "repetidas")}`} />
        )}
        {result.createdCategories > 0 && (
          <Line icon={FolderPlus} text={`Se crearon ${plural(result.createdCategories, "categoría", "categorías")}`} />
        )}
        {result.createdTags > 0 && (
          <Line icon={Tags} text={`${plural(result.createdTags, "etiqueta nueva", "etiquetas nuevas")}`} />
        )}
      </ul>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onClose} data-autofocus>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
