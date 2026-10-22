import { useRef, useState, type FormEvent } from "react";
import { LockOpen } from "lucide-react";
import { throttleSeconds } from "../../api";
import { Button } from "../../components/Button";
import { PasswordField } from "../../components/PasswordField";
import { useVaults } from "../../stores/vaults";
import { useSubmit } from "../vault/useSubmit";
import { useThrottle } from "./useThrottle";

interface Props {
  vaultId: string;
  onForgot: () => void;
}

export function UnlockForm({ vaultId, onForgot }: Props) {
  const [password, setPassword] = useState("");
  const box = useRef<HTMLFormElement>(null);
  const throttle = useThrottle();
  const { busy, error, run } = useSubmit((e) => {
    const s = throttleSeconds(e);
    if (s) throttle.start(s);
    // El campo sigue deshabilitado hasta que termina el envío.
    window.setTimeout(() => box.current?.querySelector("input")?.focus(), 0);
  });
  const waiting = throttle.remaining > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy || waiting) return;
    const pw = password;
    // La contraseña se borra del estado al enviar.
    setPassword("");
    await run(() => useVaults.getState().unlock(vaultId, pw));
  };

  return (
    <div className="flex flex-col">
      <form ref={box} onSubmit={submit} className="flex flex-col">
        <PasswordField label="Contraseña" value={password} onChange={setPassword} autoFocus disabled={busy} describedBy="lock-error" />
        {/* Reserva 24px entre el campo y el botón; crece si el mensaje ocupa más líneas. */}
        <div id="lock-error" aria-live="polite" className="min-h-6 pt-2 text-xs leading-4 text-danger">
          {waiting ? <span className="sr-only">{error}</span> : error}
          {waiting && <span aria-hidden="true">Demasiados intentos. Espera {throttle.remaining} s.</span>}
        </div>
        <Button type="submit" variant="primary" size="lg" icon={LockOpen} fullWidth loading={busy} disabled={waiting || password === ""}>
          Desbloquear
        </Button>
      </form>
      <button
        type="button"
        onClick={onForgot}
        className="mt-4 self-center rounded-md px-2 py-1 text-center text-xs font-semibold text-accent hover:underline"
      >
        ¿Olvidaste la contraseña?
      </button>
    </div>
  );
}
