import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Check, FolderOpen, KeyRound, Lock, LockKeyhole, FileInput, MoreHorizontal, Plus, ShieldCheck, Trash2 } from "lucide-react";
import * as api from "../../api";
import { Button } from "../../components/Button";
import { Popover } from "../../components/Popover";
import { SectionLabel } from "../../components/SectionLabel";
import { cn } from "../../lib/cn";
import { dirname, truncateMiddle } from "../../lib/path";
import { arrowNav } from "../../lib/useDismiss";
import { confirmAction } from "../../stores/confirm";
import { useMenu, type MenuItem } from "../../stores/menu";
import { useUi } from "../../stores/ui";
import { useVaults } from "../../stores/vaults";
import { deleteBackupWithConfirm } from "./backupActions";

const IDLE_OPTIONS = [1, 5, 10, 15, 30, 60];

const idleLabel = (m: number) => (m === 0 ? "Nunca" : m === 1 ? "1 minuto" : `${m} minutos`);

const actionClass = "flex h-8 items-center gap-2 rounded-md px-2 text-left text-[12.5px] hover:bg-hover";

export function VaultPopover() {
  const open = useUi((s) => s.popover === "vault");
  const close = useUi((s) => s.closePopover);
  const setDialog = useUi((s) => s.setVaultDialog);
  const openMenu = useMenu((s) => s.open);
  const { vaults, activeId, idleMinutes, backups, locked, rename, switchTo, setIdle, lock, openExisting, relocate, forget } =
    useVaults();
  const active = vaults.find((v) => v.id === activeId);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<api.VaultSummary | null>(null);

  useEffect(() => {
    if (open) {
      setRenamingId(null);
      setDraft("");
      setError(null);
      setAdded(null);
    }
  }, [open]);

  /** Ejecuta una acción mostrando su error (mensaje en español del backend) dentro del popover. */
  const attempt = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(api.describeError(e));
    }
  };

  const submitRename = async () => {
    const name = draft.trim();
    if (!name || !renamingId || busy) return;
    setBusy(true);
    await attempt(async () => {
      await rename(renamingId, name);
      setRenamingId(null);
    });
    setBusy(false);
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submitRename();
    } else if (e.key === "Escape") {
      // Cancela solo el campo; el popover sigue abierto.
      e.stopPropagation();
      setRenamingId(null);
      setError(null);
    }
  };

  const choose = async (v: api.VaultSummary) => {
    if (v.id === activeId) return;
    // Si no está disponible, el backend explica por qué (aviso) y el popover sigue abierto.
    if (v.available) close("vault");
    await switchTo(v.id);
  };

  const addExisting = () =>
    attempt(async () => {
      const path = await api.pickVaultFile();
      if (!path) return;
      setAdded(await openExisting(path));
    });

  const relocateVault = (v: api.VaultSummary) =>
    attempt(async () => {
      const path = await api.pickVaultFile();
      if (path) await relocate(v.id, path);
    });

  const forgetVault = async (v: api.VaultSummary) => {
    const ok = await confirmAction({
      title: "Quitar de la lista",
      message: `¿Quitar «${v.name}» de la lista? No se borra ningún archivo; podrás volver a agregarla con «Abrir bóveda existente».`,
      confirmLabel: "Quitar de la lista",
      danger: true,
    });
    if (ok) await attempt(() => forget(v.id));
  };

  const rowMenu = (v: api.VaultSummary, e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const isActive = v.id === activeId;
    const items: MenuItem[] = [
      {
        id: "reveal",
        label: "Mostrar en la carpeta",
        disabled: !v.available,
        hint: v.available ? undefined : "No se encontró el archivo",
        onSelect: () => void attempt(() => api.revealPath(v.path)),
      },
      ...(!v.available || !isActive
        ? [{ id: "relocate", label: "Reubicar…", onSelect: () => void relocateVault(v) }]
        : []),
      {
        id: "rename",
        label: "Renombrar",
        onSelect: () => {
          setRenamingId(v.id);
          setError(null);
          setDraft(v.name);
        },
      },
      {
        id: "forget",
        label: "Quitar de la lista",
        danger: true,
        separatorBefore: true,
        disabled: isActive,
        hint: isActive ? "No puedes quitar la bóveda que estás usando" : undefined,
        onSelect: () => void forgetVault(v),
      },
    ];
    openMenu({ x: r.right, y: r.bottom, label: `Opciones de ${v.name}`, items });
  };

  const idleChoices =
    IDLE_OPTIONS.includes(idleMinutes) || idleMinutes === 0
      ? IDLE_OPTIONS
      : [...IDLE_OPTIONS, idleMinutes].sort((a, b) => a - b);

  return (
    <Popover id="vault" label="Bóvedas" className="bottom-[60px] left-[68px] max-h-[calc(100%-72px)] w-[296px] overflow-y-auto">
      <SectionLabel>Bóvedas</SectionLabel>
      <div role="group" aria-label="Lista de bóvedas" onKeyDown={(e) => arrowNav(e, "[data-vault]")} className="flex flex-col gap-px">
        {vaults.map((v) => {
          const isActive = v.id === activeId;
          const where = v.custom ? truncateMiddle(dirname(v.path)) : "Carpeta de la app";
          return (
            <div key={v.id} className="flex flex-col">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-vault
                  aria-current={isActive}
                  onClick={() => void choose(v)}
                  className={cn(
                    "flex min-h-[38px] min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-hover",
                    isActive && "bg-soft",
                    !v.available && "opacity-70",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn("truncate text-[12.5px]", isActive && "font-semibold")}>{v.name}</span>
                    <span className="truncate text-[11px] text-muted" title={v.path}>
                      {v.available ? where : `No disponible · ${where}`}
                    </span>
                  </span>
                  {v.encrypted && <Lock size={12} aria-label="Protegida con contraseña" className="flex-none text-muted" />}
                  {isActive && <Check size={14} aria-label="Bóveda activa" className="flex-none text-accent" />}
                </button>
                <button
                  type="button"
                  data-vault
                  aria-label={`Opciones de ${v.name}`}
                  aria-haspopup="menu"
                  title="Opciones"
                  onClick={(e) => rowMenu(v, e)}
                  className="flex size-8 flex-none items-center justify-center rounded-md hover:bg-hover"
                >
                  <MoreHorizontal size={15} aria-hidden="true" />
                </button>
              </div>
              {!v.available && (
                <p className="px-2 pb-1 text-[11px] leading-snug text-danger">
                  No se encontró el archivo. Si lo moviste, usa Reubicar.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {renamingId && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Nuevo nombre</SectionLabel>
          <input
            autoFocus
            aria-label="Nuevo nombre de la bóveda"
            value={draft}
            maxLength={60}
            disabled={busy}
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Escribe un nombre y pulsa Enter"
            className="h-8 rounded-lg border border-line bg-rail px-2.5 text-fg"
          />
        </div>
      )}

      {added && (
        <div className="flex items-center gap-2 rounded-lg bg-soft px-2.5 py-2 text-xs">
          <span className="min-w-0 flex-1">Se agregó «{added.name}» a la lista.</span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const target = added;
              setAdded(null);
              close("vault");
              void switchTo(target.id);
            }}
          >
            Abrir
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-px border-t border-line pt-2">
        <button type="button" onClick={() => setDialog("vault-new")} className={cn(actionClass, "text-muted")}>
          <Plus size={14} aria-hidden="true" />
          Nueva bóveda…
        </button>
        <button type="button" onClick={() => void addExisting()} className={cn(actionClass, "text-muted")}>
          <FolderOpen size={14} aria-hidden="true" />
          Abrir bóveda existente…
        </button>
        <button
          type="button"
          disabled={locked || !active?.available}
          title={locked || !active?.available ? "Abre una bóveda para importar notas en ella" : undefined}
          onClick={() => setDialog("vault-import")}
          className={cn(actionClass, "text-muted disabled:opacity-50")}
        >
          <FileInput size={14} aria-hidden="true" />
          Importar notas desde otra bóveda…
        </button>
        {active && !active.encrypted && (
          <button type="button" onClick={() => setDialog("vault-protect")} className={actionClass}>
            <ShieldCheck size={14} aria-hidden="true" />
            Proteger con contraseña…
          </button>
        )}
        {active?.encrypted && (
          <>
            <button type="button" onClick={() => setDialog("vault-password")} className={actionClass}>
              <KeyRound size={14} aria-hidden="true" />
              Cambiar contraseña…
            </button>
            <button
              type="button"
              onClick={() => {
                close("vault");
                void lock();
              }}
              className={actionClass}
            >
              <LockKeyhole size={14} aria-hidden="true" />
              Bloquear ahora
            </button>
          </>
        )}
      </div>

      {backups.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-line pt-2">
          <SectionLabel>Copia sin cifrar</SectionLabel>
          <p className="text-[11.5px] leading-normal text-muted">
            Tu bóveda anterior sigue guardada sin cifrar. Bórrala cuando confirmes que todo funciona.
          </p>
          {backups.map((file) => (
            <div key={file} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted" title={file}>
                {file}
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={() => void deleteBackupWithConfirm(file)}
                className="text-danger hover:text-danger"
              >
                Borrar copia
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="vault-idle" className="text-xs font-semibold">
          Bloquear tras inactividad
        </label>
        <select
          id="vault-idle"
          value={idleMinutes}
          disabled={locked}
          onChange={(e) => void setIdle(Number(e.target.value))}
          className="h-8 rounded-lg border border-line bg-rail px-2 text-[12.5px] text-fg"
        >
          {idleChoices.map((m) => (
            <option key={m} value={m}>
              {idleLabel(m)}
            </option>
          ))}
          <option value={0}>{idleLabel(0)}</option>
        </select>
        <p className="text-[11px] text-muted">Solo afecta a las bóvedas con contraseña.</p>
      </div>
    </Popover>
  );
}
