import { useState } from "react";
import { FileSearch, FileWarning, RotateCcw } from "lucide-react";
import * as api from "../../api";
import { Button } from "../../components/Button";
import { useNotes } from "../../stores/notes";
import { useVaults } from "../../stores/vaults";
import { VaultSidebar } from "./VaultSidebar";

/** Se muestra cuando la bóveda activa ya no está en su ubicación: elegir otra o reubicar esta. */
export function UnavailableScreen() {
  const active = useVaults((s) => s.vaults.find((v) => v.id === s.activeId));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const ok = await useVaults.getState().load();
    if (ok) await useNotes.getState().reset();
  };

  const relocate = async () => {
    if (!active || busy) return;
    setError(null);
    setBusy(true);
    try {
      const path = await api.pickVaultFile();
      if (!path) return;
      await useVaults.getState().relocate(active.id, path);
      await reload();
    } catch (e) {
      setError(api.describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-rail p-6">
      <div className="flex w-[760px] max-w-full overflow-hidden rounded-[18px] border border-line bg-main shadow-[0_24px_60px_rgba(0,0,0,.4)]">
        <VaultSidebar />
        <section className="box-border flex min-w-0 flex-1 flex-col gap-5 px-11 py-11">
          <div className="flex size-12 items-center justify-center rounded-full bg-soft text-accent">
            <FileWarning size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl leading-[1.2] font-bold tracking-[-.01em]">Bóveda no disponible</h1>
            <p className="text-sm leading-[1.55] text-muted">
              <span className="font-semibold text-fg">{active?.name ?? ""}</span>
              {" · "}No se encontró el archivo. Si lo moviste, usa Reubicar. También puedes elegir otra bóveda de la lista.
            </p>
            {active && (
              <p data-selectable className="font-mono text-xs break-all text-muted">
                {active.path}
              </p>
            )}
          </div>
          <div aria-live="polite" className="min-h-4 text-xs text-danger">
            {error}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" icon={FileSearch} disabled={busy} onClick={() => void relocate()}>
              Reubicar…
            </Button>
            <Button variant="secondary" icon={RotateCcw} disabled={busy} onClick={() => void reload()}>
              Reintentar
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
