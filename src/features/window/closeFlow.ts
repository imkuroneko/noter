import * as api from "../../api";
import { useNotes } from "../../stores/notes";
import { useUi } from "../../stores/ui";

const FLUSH_TIMEOUT = 2000;
const FORCE_WINDOW = 10_000;

let forceNext = false;
let forceTimer: number | undefined;

/**
 * Guarda lo pendiente y cierra. Si el guardado falla o tarda más de ~2 s, avisa y no cierra;
 * un segundo intento (en los siguientes 10 s) cierra de todos modos.
 */
export async function requestClose(): Promise<void> {
  const timeout = new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), FLUSH_TIMEOUT));
  const saved = await Promise.race([useNotes.getState().flush(), timeout]);
  if (saved || forceNext) {
    await api.windowDestroy();
    return;
  }
  forceNext = true;
  window.clearTimeout(forceTimer);
  forceTimer = window.setTimeout(() => (forceNext = false), FORCE_WINDOW);
  useUi
    .getState()
    .showNotice("No se pudo guardar la nota abierta. Vuelve a cerrar para salir sin guardar esos cambios.");
}
