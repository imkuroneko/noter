import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { Modal } from "../../components/Modal";
import { PasswordField } from "../../components/PasswordField";
import { validateNewPassword } from "../../lib/password";
import { useRecovery } from "../../stores/recovery";
import { useUi } from "../../stores/ui";
import { useVaults } from "../../stores/vaults";
import { DialogActions } from "./DialogActions";
import { useSubmit } from "./useSubmit";

export function ProtectVaultDialog() {
  const close = () => useUi.getState().setVaultDialog(null);
  const vaultName = useVaults((s) => s.vaults.find((v) => v.id === s.activeId)?.name ?? "");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const { busy, error, setError, run } = useSubmit();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = validateNewPassword(password, repeat);
    if (invalid) {
      setError(invalid);
      return;
    }
    const pw = password;
    setPassword("");
    setRepeat("");
    const ok = await run(async () => {
      const r = await useVaults.getState().protect(pw);
      useRecovery.getState().show({ vaultName, recoveryKey: r.recoveryKey, backupFile: r.backupFile });
    });
    if (ok) close();
  };

  return (
    <Modal title="Proteger con contraseña" onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-[13px] leading-normal text-muted">
          Se cifrará la bóveda «{vaultName}». Antes se guarda una copia de respaldo sin cifrar de la versión actual;
          conviene borrarla cuando confirmes que todo funciona.
        </p>
        <PasswordField label="Contraseña" value={password} onChange={setPassword} autoComplete="new-password" autoFocus describedBy="protect-help" />
        <PasswordField label="Repetir contraseña" value={repeat} onChange={setRepeat} autoComplete="new-password" describedBy="protect-help" />
        <p id="protect-help" className="text-xs text-muted">
          Mínimo 8 caracteres. Te daremos una clave de recuperación que solo se muestra una vez.
        </p>
        <DialogActions busy={busy} error={error} submitLabel="Proteger bóveda" submitIcon={ShieldCheck} onCancel={close} />
      </form>
    </Modal>
  );
}
