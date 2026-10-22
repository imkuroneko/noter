import { create } from "zustand";
import * as api from "../api";
import { useNotes } from "./notes";
import { useUi } from "./ui";

interface VaultsState {
  vaults: api.VaultSummary[];
  activeId: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  /** Los errores suben al popover, que los muestra junto al formulario. */
  create: (name: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  switchTo: (id: string) => Promise<void>;
}

export const useVaults = create<VaultsState>((set, get) => {
  const apply = (l: api.VaultList) => set({ vaults: l.vaults, activeId: l.activeId, loaded: true });
  return {
    vaults: [],
    activeId: null,
    loaded: false,

    load: async () => {
      try {
        apply(await api.vaultList());
      } catch (e) {
        useUi.getState().showNotice(api.describeError(e));
      }
    },

    create: async (name) => {
      apply(await api.vaultCreate(name));
    },

    rename: async (id, name) => {
      apply(await api.vaultRename(id, name));
    },

    switchTo: async (id) => {
      if (id === get().activeId) return;
      // Antes de cambiar de bóveda se guarda lo pendiente; si falla, no se cambia.
      if (!(await useNotes.getState().flush())) {
        useUi.getState().showNotice("No se pudo guardar la nota abierta, así que no se cambió de bóveda.");
        return;
      }
      try {
        apply(await api.vaultSwitch(id));
      } catch (e) {
        useUi.getState().showNotice(api.describeError(e));
        return;
      }
      await useNotes.getState().reset();
    },
  };
});
