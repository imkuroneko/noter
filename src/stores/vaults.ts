import { create } from "zustand";
import * as api from "../api";
import { useConfirm } from "./confirm";
import { useMenu } from "./menu";
import { useNotes } from "./notes";
import { useRecovery } from "./recovery";
import { useUi } from "./ui";

const FLUSH_TIMEOUT = 2000;

interface VaultsState {
  vaults: api.VaultSummary[];
  activeId: string | null;
  locked: boolean;
  /** Hay una bóveda abierta; si no está bloqueada y esto es false, la activa no se pudo abrir. */
  open: boolean;
  idleMinutes: number;
  backups: string[];
  loaded: boolean;
  /** Mensaje si no se pudo leer el estado de las bóvedas al arrancar. */
  loadError: string | null;
  /** Estado actual al arrancar. Devuelve true si hay una bóveda desbloqueada y se puede cargar. */
  load: () => Promise<boolean>;
  /** Los errores de las acciones con contraseña suben al formulario, que los muestra en línea. */
  create: (name: string, password?: string, folder?: string) => Promise<string | null>;
  /** Agrega una bóveda existente a la lista; devuelve la bóveda nueva. */
  openExisting: (path: string) => Promise<api.VaultSummary | null>;
  relocate: (id: string, path: string) => Promise<void>;
  forget: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  switchTo: (id: string) => Promise<void>;
  unlock: (id: string, password: string) => Promise<void>;
  recover: (id: string, recoveryKey: string, newPassword: string) => Promise<void>;
  lock: () => Promise<void>;
  /** El backend ya bloqueó (inactividad): solo se limpia la interfaz. */
  handleLocked: () => Promise<void>;
  protect: (password: string) => Promise<{ recoveryKey: string; backupFile: string }>;
  changePassword: (id: string, oldPassword: string, newPassword: string) => Promise<void>;
  setIdle: (minutes: number) => Promise<void>;
  deleteBackup: (file: string) => Promise<void>;
}

/** Espera el guardado pendiente un máximo de ~2 s. */
async function flushPending(): Promise<boolean> {
  const timeout = new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), FLUSH_TIMEOUT));
  return Promise.race([useNotes.getState().flush(), timeout]);
}

/** Vacía todo lo que tenga datos privados en memoria del frontend. */
function scrub() {
  useNotes.getState().wipe();
  useMenu.getState().close();
  useConfirm.getState().answer(false);
  useRecovery.getState().clear();
  useUi.setState({ popover: null, vaultDialog: null, notice: null, pendingFocus: false });
}

export const useVaults = create<VaultsState>((set, get) => {
  const apply = (s: api.VaultStatus) =>
    set({ vaults: s.vaults, activeId: s.activeId, locked: s.locked, open: s.open, idleMinutes: s.idleMinutes, backups: s.backups ?? [], loaded: true });
  const notice = (e: unknown) => useUi.getState().showNotice(api.describeError(e));

  return {
    vaults: [],
    activeId: null,
    locked: false,
    open: false,
    idleMinutes: 5,
    backups: [],
    loaded: false,
    loadError: null,

    load: async () => {
      try {
        const s = await api.vaultList();
        apply(s);
        set({ loadError: null });
        return !s.locked && s.open;
      } catch (e) {
        set({ loaded: true, loadError: api.describeError(e) });
        return false;
      }
    },

    openExisting: async (path) => {
      const before = new Set(get().vaults.map((v) => v.id));
      const status = await api.vaultOpenExisting(path);
      apply(status);
      return status.vaults.find((v) => !before.has(v.id)) ?? null;
    },

    relocate: async (id, path) => {
      apply(await api.vaultRelocate(id, path));
    },

    forget: async (id) => {
      apply(await api.vaultForget(id));
    },

    create: async (name, password, folder) => {
      const created = await api.vaultCreate(name, password, folder);
      apply(created.status);
      return created.recoveryKey;
    },

    rename: async (id, name) => {
      apply(await api.vaultRename(id, name));
    },

    switchTo: async (id) => {
      if (id === get().activeId) return;
      // Antes de cambiar de bóveda se guarda lo pendiente; si falla, no se cambia.
      if (!(await flushPending())) {
        useUi.getState().showNotice("No se pudo guardar la nota abierta, así que no se cambió de bóveda.");
        return;
      }
      let status: api.VaultStatus;
      try {
        status = await api.vaultSwitch(id);
      } catch (e) {
        notice(e);
        return;
      }
      scrub();
      apply(status);
      if (!status.locked) await useNotes.getState().init();
    },

    unlock: async (id, password) => {
      const status = await api.vaultUnlock(id, password);
      apply(status);
      await useNotes.getState().reset();
    },

    recover: async (id, recoveryKey, newPassword) => {
      const status = await api.vaultRecover(id, recoveryKey, newPassword);
      apply(status);
      await useNotes.getState().reset();
    },

    lock: async () => {
      if (!(await flushPending())) {
        useUi.getState().showNotice("No se pudo guardar la nota abierta, así que no se bloqueó la bóveda.");
        return;
      }
      try {
        const status = await api.vaultLock();
        scrub();
        apply(status);
      } catch (e) {
        notice(e);
      }
    },

    handleLocked: async () => {
      // El backend ya cerró la base: no se intenta guardar (fallaría). Se limpia y se lee el estado.
      scrub();
      try {
        apply(await api.vaultList());
      } catch (e) {
        notice(e);
        set({ locked: true });
      }
    },

    protect: async (password) => {
      const r = await api.vaultProtect(password);
      apply(r.status);
      return { recoveryKey: r.recoveryKey, backupFile: r.backupFile };
    },

    changePassword: async (id, oldPassword, newPassword) => {
      await api.vaultChangePassword(id, oldPassword, newPassword);
    },

    deleteBackup: async (file) => {
      try {
        apply(await api.vaultDeleteBackup(file));
      } catch (e) {
        notice(e);
      }
    },

    setIdle: async (minutes) => {
      try {
        apply(await api.vaultSetIdle(minutes));
      } catch (e) {
        notice(e);
      }
    },
  };
});
