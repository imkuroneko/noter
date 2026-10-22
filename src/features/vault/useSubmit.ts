import { useState } from "react";
import { describeError } from "../../api";

/** Estado de envío de un formulario: ocupado ("Verificando…") y error en línea. */
export function useSubmit(onError?: (e: unknown) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(describeError(e));
      onError?.(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, setError, run };
}
