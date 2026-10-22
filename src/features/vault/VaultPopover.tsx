import { useEffect, useState, type KeyboardEvent } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { describeError } from "../../api";
import { Popover } from "../../components/Popover";
import { SectionLabel } from "../../components/SectionLabel";
import { cn } from "../../lib/cn";
import { arrowNav } from "../../lib/useDismiss";
import { useUi } from "../../stores/ui";
import { useVaults } from "../../stores/vaults";

type Mode = "list" | "create" | "rename";

export function VaultPopover() {
  const open = useUi((s) => s.popover === "vault");
  const close = useUi((s) => s.closePopover);
  const { vaults, activeId, create, rename, switchTo } = useVaults();
  const [mode, setMode] = useState<Mode>("list");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("list");
      setDraft("");
      setError(null);
    }
  }, [open]);

  const start = (next: Mode) => {
    setMode(next);
    setError(null);
    setDraft(next === "rename" ? (vaults.find((v) => v.id === activeId)?.name ?? "") : "");
  };

  const submit = async () => {
    const name = draft.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") await create(name);
      else if (mode === "rename" && activeId) await rename(activeId, name);
      setMode("list");
      setDraft("");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    } else if (e.key === "Escape") {
      // Cancela solo el campo; el popover sigue abierto.
      e.stopPropagation();
      setMode("list");
      setError(null);
    }
  };

  const choose = async (id: string) => {
    if (id === activeId) return;
    close("vault");
    await switchTo(id);
  };

  return (
    <Popover id="vault" label="Bóvedas" className="bottom-[60px] left-[68px] w-[256px]">
      <SectionLabel>Bóvedas</SectionLabel>
      <div role="group" aria-label="Lista de bóvedas" onKeyDown={(e) => arrowNav(e, "[data-vault]")} className="flex flex-col gap-px">
        {vaults.map((v) => {
          const active = v.id === activeId;
          return (
            <div key={v.id} className="flex items-center gap-1">
              <button
                type="button"
                data-vault
                aria-current={active}
                onClick={() => void choose(v.id)}
                className={cn(
                  "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-[12.5px] hover:bg-hover",
                  active && "bg-soft font-semibold",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{v.name}</span>
                {active && <Check size={14} aria-label="Bóveda activa" className="flex-none text-accent" />}
              </button>
              {active && (
                <button
                  type="button"
                  aria-label="Renombrar bóveda"
                  title="Renombrar bóveda"
                  onClick={() => start("rename")}
                  className="flex size-8 flex-none items-center justify-center rounded-md hover:bg-hover"
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {mode === "list" ? (
        <button
          type="button"
          onClick={() => start("create")}
          className="flex h-8 items-center gap-2 rounded-md border border-dashed border-line px-2 text-[12.5px] text-muted hover:bg-hover"
        >
          <Plus size={14} aria-hidden="true" />
          Nueva bóveda
        </button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>{mode === "create" ? "Nombre de la nueva bóveda" : "Nuevo nombre"}</SectionLabel>
          <input
            autoFocus
            aria-label={mode === "create" ? "Nombre de la nueva bóveda" : "Nuevo nombre de la bóveda"}
            value={draft}
            maxLength={60}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Escribe un nombre y pulsa Enter"
            className="h-8 rounded-lg border border-line bg-rail px-2.5 text-fg"
          />
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </Popover>
  );
}
