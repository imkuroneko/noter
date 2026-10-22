import { confirmAction } from "../../stores/confirm";
import { useVaults } from "../../stores/vaults";

/** Pide confirmación y borra la copia sin cifrar. Devuelve true si se borró. */
export async function deleteBackupWithConfirm(file: string): Promise<boolean> {
  const ok = await confirmAction({
    title: "Borrar copia sin cifrar",
    message: "¿Borrar la copia sin cifrar? Esta acción no se puede deshacer.",
    confirmLabel: "Borrar copia",
    danger: true,
  });
  if (ok) await useVaults.getState().deleteBackup(file);
  return ok;
}
