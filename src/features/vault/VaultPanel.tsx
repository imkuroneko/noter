import { ChevronsUpDown, LockKeyhole, LockKeyholeOpen, Palette } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { useUi } from "../../stores/ui";
import { useVaults } from "../../stores/vaults";

/** Panel inferior de la lista, como el panel de usuario de Discord. */
export function VaultPanel() {
  const toggle = useUi((s) => s.togglePopover);
  const themeOpen = useUi((s) => s.popover === "theme");
  const vaultOpen = useUi((s) => s.popover === "vault");
  const active = useVaults((s) => s.vaults.find((v) => v.id === s.activeId));
  const lock = useVaults((s) => s.lock);
  const pendingBackups = useVaults((s) => s.backups.length);
  const protectedVault = active?.encrypted === true;
  return (
    <div className="box-border flex h-[52px] flex-none items-center gap-1 bg-rail pr-2 pl-2">
      <button
        type="button"
        data-popover-trigger="vault"
        aria-haspopup="dialog"
        aria-expanded={vaultOpen}
        aria-label={`Cambiar de bóveda (activa: ${active?.name ?? "cargando"})`}
        title="Cambiar de bóveda"
        onClick={() => toggle("vault")}
        className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg pl-1 hover:bg-hover"
      >
        <span className="flex size-[30px] flex-none items-center justify-center rounded-full bg-soft text-accent">
          {protectedVault ? (
            <LockKeyhole size={15} strokeWidth={2} aria-hidden="true" />
          ) : (
            <LockKeyholeOpen size={15} strokeWidth={2} aria-hidden="true" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[12.5px] font-semibold">{active?.name ?? "Bóveda"}</span>
          <span className="flex items-center gap-1 truncate text-[11px] text-muted">
            {protectedVault && <LockKeyhole size={10} aria-hidden="true" className="flex-none" />}
            {protectedVault ? "Protegida" : "Sin contraseña"}
          </span>
        </span>
        {pendingBackups > 0 && (
          <span
            role="img"
            aria-label="Hay una copia sin cifrar pendiente de borrar"
            title="Hay una copia sin cifrar pendiente de borrar"
            className="size-1.5 flex-none rounded-full bg-accent"
          />
        )}
        <ChevronsUpDown size={13} aria-hidden="true" className="mr-1 flex-none text-muted" />
      </button>
      <IconButton
        label="Elegir tema"
        title="Tema"
        data-popover-trigger="theme"
        aria-expanded={themeOpen}
        onClick={() => toggle("theme")}
      >
        <Palette size={16} strokeWidth={1.8} aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Bloquear ahora"
        title={
          protectedVault
            ? "Bloquear ahora"
            : "Esta bóveda no tiene contraseña. Protégela para poder bloquearla"
        }
        disabled={!protectedVault}
        onClick={() => void lock()}
      >
        <LockKeyhole size={16} strokeWidth={1.8} aria-hidden="true" />
      </IconButton>
    </div>
  );
}
