import { cn } from "../../lib/cn";
import { useVaults } from "../../stores/vaults";

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase() || "?";

/** Lista de bóvedas de las pantallas de bloqueo y de "no disponible". */
export function VaultSidebar({ onPick }: { onPick?: () => void }) {
  const vaults = useVaults((s) => s.vaults);
  const activeId = useVaults((s) => s.activeId);
  const switchTo = useVaults((s) => s.switchTo);

  return (
    <aside className="box-border flex w-[230px] flex-none flex-col gap-3.5 border-r border-line bg-side px-[22px] py-7">
      <span className="text-[11px] font-bold tracking-[.06em] text-muted uppercase">Bóvedas</span>
      <div role="group" aria-label="Bóvedas" className="flex flex-col gap-1">
        {vaults.map((v) => {
          const on = v.id === activeId;
          return (
            <button
              key={v.id}
              type="button"
              aria-current={on}
              aria-disabled={!v.available || undefined}
              onClick={() => {
                if (on) return;
                onPick?.();
                // Si no está disponible, el backend responde con el motivo y se muestra como aviso.
                void switchTo(v.id);
              }}
              className={cn("flex items-center gap-2.5 rounded-[10px] p-2 hover:bg-hover", on && "bg-hover", !v.available && "opacity-60")}
            >
              <span
                className={cn(
                  "flex size-[34px] flex-none items-center justify-center rounded-xl font-bold",
                  on ? "bg-accent text-onaccent" : "bg-rail text-muted",
                )}
              >
                {initials(v.name)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-semibold">{v.name}</span>
                <span className="text-[11.5px] text-muted">
                  {!v.available ? "No disponible" : v.encrypted ? "Protegida" : "Sin contraseña"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
