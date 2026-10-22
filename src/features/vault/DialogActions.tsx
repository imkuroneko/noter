import { Button } from "../../components/Button";
import type { LucideIcon } from "lucide-react";

interface Props {
  busy: boolean;
  error: string | null;
  submitLabel: string;
  submitIcon?: LucideIcon;
  onCancel: () => void;
  submitDisabled?: boolean;
}

/** Mensaje de error en línea y botones Cancelar / acción de un formulario de diálogo. */
export function DialogActions({ busy, error, submitLabel, submitIcon, onCancel, submitDisabled }: Props) {
  return (
    <>
      <div aria-live="polite" className="min-h-4 text-xs text-danger">
        {error}
      </div>
      <div className="mt-1 flex justify-end gap-2">
        <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="md" icon={submitIcon} loading={busy} disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </div>
    </>
  );
}
