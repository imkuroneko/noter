import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, Trash2 } from "lucide-react";
import { dataFolder } from "../../api";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { deleteBackupWithConfirm } from "./backupActions";
import { useRecovery } from "../../stores/recovery";
import { useVaults } from "../../stores/vaults";

const CLIPBOARD_CLEAR_MS = 60_000;

type CopyState = "idle" | "copied" | "failed";

/** Se muestra una sola vez tras crear una bóveda con contraseña o proteger la actual. */
export function RecoveryKeyDialog() {
  const pending = useRecovery((s) => s.pending);
  const clear = useRecovery((s) => s.clear);
  const keyRef = useRef<HTMLElement>(null);
  const [saved, setSaved] = useState(false);
  const [copy, setCopy] = useState<CopyState>("idle");
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const backupFile = pending?.backupFile ?? null;
  const stillThere = useVaults((s) => (backupFile ? s.backups.includes(backupFile) : false));
  const clipTimer = useRef<number | undefined>(undefined);
  const [clipArmed, setClipArmed] = useState(false);

  // Vacía el portapapeles a los 60 s, o antes si se cierra el diálogo (esfuerzo razonable, no una garantía).
  useEffect(() => {
    return () => {
      if (clipTimer.current !== undefined) {
        window.clearTimeout(clipTimer.current);
        clipTimer.current = undefined;
        void navigator.clipboard.writeText("").catch(() => undefined);
      }
    };
  }, [pending]);

  useEffect(() => {
    if (!backupFile) return;
    let alive = true;
    void dataFolder().then((dir) => {
      if (!alive) return;
      const sep = dir?.includes("\\") ? "\\" : "/";
      setBackupPath(dir ? `${dir}${sep}backups${sep}${backupFile}` : `backups${sep}${backupFile}`);
    });
    return () => {
      alive = false;
    };
  }, [backupFile]);

  useEffect(() => {
    if (copy === "idle") return;
    const t = window.setTimeout(() => setCopy("idle"), 2500);
    return () => window.clearTimeout(t);
  }, [copy]);

  if (!pending) return null;

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(pending.recoveryKey);
      setCopy("copied");
      setClipArmed(true);
      window.clearTimeout(clipTimer.current);
      clipTimer.current = window.setTimeout(() => {
        clipTimer.current = undefined;
        setClipArmed(false);
        void navigator.clipboard.writeText("").catch(() => undefined);
      }, CLIPBOARD_CLEAR_MS);
    } catch {
      // Sin acceso al portapapeles: se deja la clave seleccionada para copiarla a mano.
      const el = keyRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setCopy("failed");
    }
  };

  return (
    <Modal title="Clave de recuperación" width={460}>
      <p className="text-[13px] leading-normal text-muted">
        Guarda esta clave de recuperación. Es la única forma de volver a tus notas si olvidas la contraseña. Solo se
        muestra ahora.
      </p>
      <div className="rounded-[10px] border border-line bg-code p-3.5">
        <code
          ref={keyRef}
          data-selectable
          tabIndex={-1}
          className="block font-mono text-[15px] leading-relaxed tracking-wide break-words"
        >
          {pending.recoveryKey}
        </code>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" icon={copy === "copied" ? Check : Copy} onClick={() => void copyKey()}>
          {copy === "copied" ? "Copiada" : "Copiar"}
        </Button>
        <span aria-live="polite" className="text-xs text-muted">
          {copy === "failed" && "No se pudo copiar. La clave quedó seleccionada: cópiala con Ctrl+C."}
        </span>
        {clipArmed && <span className="text-xs text-muted">Se vaciará el portapapeles en 60 s.</span>}
      </div>
      {backupFile && (
        <p className="text-xs leading-normal text-muted">
          Se guardó una copia sin cifrar de tu bóveda anterior en{" "}
          <span data-selectable className="font-mono break-all">
            {backupPath ?? `backups/${backupFile}`}
          </span>
          . Bórrala cuando confirmes que todo funciona.
        </p>
      )}
      {backupFile && stillThere && (
        <Button
          variant="secondary"
          size="sm"
          icon={Trash2}
          disabled={!saved}
          onClick={() => void deleteBackupWithConfirm(backupFile)}
          className="self-start text-danger"
        >
          Borrar copia ahora
        </Button>
      )}
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="size-4 accent-[var(--accent)]"
        />
        Ya la guardé en un lugar seguro
      </label>
      <div className="flex justify-end">
        <Button variant="primary" size="md" icon={ArrowRight} iconAfter disabled={!saved} onClick={clear}>
          Continuar
        </Button>
      </div>
    </Modal>
  );
}
