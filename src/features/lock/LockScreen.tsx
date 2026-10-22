import { useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useVaults } from "../../stores/vaults";
import { RecoverForm } from "./RecoverForm";
import { UnlockForm } from "./UnlockForm";
import { VaultSidebar } from "./VaultSidebar";

/** Pantalla de bloqueo. Se muestra solo mientras la bóveda activa está bloqueada. */
export function LockScreen() {
  const vaults = useVaults((s) => s.vaults);
  const activeId = useVaults((s) => s.activeId);
  const idleMinutes = useVaults((s) => s.idleMinutes);
  const [recovering, setRecovering] = useState(false);
  const active = vaults.find((v) => v.id === activeId);

  const idle =
    idleMinutes > 0
      ? ` Se bloquea sola tras ${idleMinutes} ${idleMinutes === 1 ? "minuto" : "minutos"} sin actividad.`
      : "";

  // Escala de espaciado: tarjeta 40px, 20px entre grupos, 8px título-subtítulo, pie con 20px.
  // El contenedor desplaza (overflow-auto) y la tarjeta usa m-auto: nada se corta en ventanas bajas.
  return (
    <main className="flex min-h-0 flex-1 overflow-auto bg-rail p-6">
      <div className="m-auto flex w-[760px] max-w-full overflow-hidden rounded-[18px] border border-line bg-main shadow-[0_24px_60px_rgba(0,0,0,.4)]">
        <VaultSidebar onPick={() => setRecovering(false)} />

        <section className="box-border flex min-w-0 flex-1 flex-col gap-5 p-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-soft text-accent">
            <LockKeyhole size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl leading-[1.2] font-bold tracking-[-.01em]">
              {recovering ? "Recuperar acceso" : "Bóveda bloqueada"}
            </h1>
            <p className="text-sm leading-[1.55] text-muted">
              <span className="font-semibold text-fg">{active?.name ?? ""}</span>
              {" · "}
              {recovering
                ? "Escribe tu clave de recuperación y elige una contraseña nueva."
                : `Escribe tu contraseña para abrir tus notas.${idle}`}
            </p>
          </div>
          {active &&
            (recovering ? (
              <RecoverForm key={`r-${active.id}`} vaultId={active.id} onBack={() => setRecovering(false)} />
            ) : (
              <UnlockForm key={`u-${active.id}`} vaultId={active.id} onForgot={() => setRecovering(true)} />
            ))}
          <div className="mt-auto flex items-center gap-2 border-t border-line pt-5 text-xs text-muted">
            <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>Base de datos SQLite cifrada en este equipo</span>
          </div>
        </section>
      </div>
    </main>
  );
}
