import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { Modal } from "../../components/Modal";
import { PasswordField } from "../../components/PasswordField";
import { validateNewPassword } from "../../lib/password";
import { useUi } from "../../stores/ui";
import { useVaults } from "../../stores/vaults";
import { DialogActions } from "./DialogActions";
import { useSubmit } from "./useSubmit";

export function ChangePasswordDialog() {
  const close = () => useUi.getState().setVaultDialog(null);
  const activeId = useVaults((s) => s.activeId);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const { busy, error, setError, run } = useSubmit();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeId) return;
    const invalid = validateNewPassword(next, repeat);
    if (invalid) {
      setError(invalid);
      return;
    }
    const [oldPw, newPw] = [current, next];
    setCurrent("");
    setNext("");
    setRepeat("");
    const ok = await run(() => useVaults.getState().changePassword(activeId, oldPw, newPw));
    if (ok) {
      close();
      useUi.getState().showNotice("Contraseña cambiada.");
    }
  };

  return (
    <Modal title="Cambiar contraseña" onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <PasswordField label="Contraseña actual" value={current} onChange={setCurrent} autoFocus />
        <PasswordField label="Contraseña nueva" value={next} onChange={setNext} autoComplete="new-password" describedBy="change-help" />
        <PasswordField label="Repetir contraseña nueva" value={repeat} onChange={setRepeat} autoComplete="new-password" describedBy="change-help" />
        <p id="change-help" className="text-xs text-muted">
          Mínimo 8 caracteres. La clave de recuperación sigue siendo la misma.
        </p>
        <DialogActions busy={busy} error={error} submitLabel="Cambiar contraseña" submitIcon={KeyRound} onCancel={close} submitDisabled={current === ""} />
      </form>
    </Modal>
  );
}
