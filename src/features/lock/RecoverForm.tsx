import { useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { throttleSeconds } from "../../api";
import { Button } from "../../components/Button";
import { PasswordField } from "../../components/PasswordField";
import { validateNewPassword } from "../../lib/password";
import { useVaults } from "../../stores/vaults";
import { useSubmit } from "../vault/useSubmit";
import { useThrottle } from "./useThrottle";

interface Props {
  vaultId: string;
  onBack: () => void;
}

export function RecoverForm({ vaultId, onBack }: Props) {
  const [key, setKey] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const throttle = useThrottle();
  const { busy, error, setError, run } = useSubmit((e) => {
    const s = throttleSeconds(e);
    if (s) throttle.start(s);
  });
  const waiting = throttle.remaining > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || waiting || key.trim() === "") return;
    const invalid = validateNewPassword(password, repeat);
    if (invalid) {
      setError(invalid);
      return;
    }
    // Mayúsculas o minúsculas, con o sin guiones y espacios: el backend la normaliza; aquí solo se limpia el borde.
    const recoveryKey = key.trim();
    const pw = password;
    setKey("");
    setPassword("");
    setRepeat("");
    await run(() => useVaults.getState().recover(vaultId, recoveryKey, pw));
  };

  return (
    <div className="flex flex-col">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="recovery-key" className="text-xs font-semibold">
            Clave de recuperación
          </label>
          <input
            id="recovery-key"
            data-autofocus
            autoFocus
            value={key}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="off"
            onChange={(e) => setKey(e.target.value)}
            className="box-border h-11 rounded-[10px] border border-line bg-rail px-3.5 font-mono tracking-wide text-fg focus:border-accent focus:outline-none"
          />
        </div>
        <PasswordField label="Contraseña nueva" value={password} onChange={setPassword} autoComplete="new-password" disabled={busy} describedBy="recover-error" />
        <PasswordField label="Repetir contraseña nueva" value={repeat} onChange={setRepeat} autoComplete="new-password" disabled={busy} describedBy="recover-error" />
        <div id="recover-error" aria-live="polite" className="-mb-1 min-h-5 text-xs leading-4 text-danger">
          {waiting ? <span className="sr-only">{error}</span> : error}
          {waiting && <span aria-hidden="true">Demasiados intentos. Espera {throttle.remaining} s.</span>}
        </div>
        <Button type="submit" variant="primary" size="lg" icon={KeyRound} fullWidth loading={busy} disabled={waiting || key.trim() === ""}>
          Recuperar acceso
        </Button>
      </form>
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} disabled={busy} className="mt-4 self-center">
        Volver
      </Button>
    </div>
  );
}
