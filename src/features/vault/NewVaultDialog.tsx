import { useState, type FormEvent } from "react";
import * as api from "../../api";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { PasswordField } from "../../components/PasswordField";
import { validateNewPassword } from "../../lib/password";
import { useRecovery } from "../../stores/recovery";
import { useUi } from "../../stores/ui";
import { useVaults } from "../../stores/vaults";
import { DialogActions } from "./DialogActions";
import { useSubmit } from "./useSubmit";

export function NewVaultDialog() {
  const close = () => useUi.getState().setVaultDialog(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const { busy, error, setError, run } = useSubmit();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const withPassword = password !== "" || repeat !== "";
    if (withPassword) {
      const invalid = validateNewPassword(password, repeat);
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    const pw = withPassword ? password : undefined;
    // Las contraseñas se borran del estado al enviar.
    setPassword("");
    setRepeat("");
    const ok = await run(async () => {
      const recoveryKey = await useVaults.getState().create(cleanName, pw, folder ?? undefined);
      if (recoveryKey) useRecovery.getState().show({ vaultName: cleanName, recoveryKey, backupFile: null });
    });
    if (ok) close();
  };

  return (
    <Modal title="Nueva bóveda" onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-vault-name" className="text-xs font-semibold">
            Nombre
          </label>
          <input
            id="new-vault-name"
            data-autofocus
            value={name}
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setName(e.target.value)}
            className="box-border h-[42px] rounded-[10px] border border-line bg-rail px-3.5 text-fg"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold">Ubicación</span>
          <div className="flex items-center gap-2">
            <span
              title={folder ?? "Carpeta de la app (predeterminada)"}
              className="box-border flex h-8 min-w-0 flex-1 items-center rounded-lg border border-line bg-rail px-2.5 text-xs text-muted"
            >
              <span className="truncate">{folder ?? "Carpeta de la app (predeterminada)"}</span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={FolderOpen}
              onClick={() => void api.pickFolder().then((f) => f && setFolder(f)).catch(() => undefined)}
            >
              Elegir carpeta…
            </Button>
          </div>
          {folder && (
            <button type="button" onClick={() => setFolder(null)} className="self-start text-xs font-semibold text-accent hover:underline">
              Usar la predeterminada
            </button>
          )}
          <p className="text-xs text-muted">
            La base y su archivo de claves se guardan juntos en esa carpeta. Puedes sincronizarla con una nube o
            copiarla a otro equipo.
          </p>
        </div>
        <PasswordField label="Contraseña (opcional)" value={password} onChange={setPassword} autoComplete="new-password" describedBy="new-vault-help" />
        <PasswordField label="Repetir contraseña" value={repeat} onChange={setRepeat} autoComplete="new-password" describedBy="new-vault-help" />
        <p id="new-vault-help" className="text-xs text-muted">
          Mínimo 8 caracteres. Déjala vacía para crear una bóveda sin contraseña.
        </p>
        <DialogActions busy={busy} error={error} submitLabel="Crear bóveda" submitIcon={Plus} onCancel={close} submitDisabled={name.trim() === ""} />
      </form>
    </Modal>
  );
}
