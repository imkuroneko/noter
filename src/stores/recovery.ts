import { create } from "zustand";

export interface PendingRecovery {
  vaultName: string;
  /** Solo en memoria; se descarta al cerrar el diálogo. Nunca se persiste. */
  recoveryKey: string;
  /** Presente cuando la clave viene de "Proteger con contraseña". */
  backupFile: string | null;
}

interface RecoveryState {
  pending: PendingRecovery | null;
  show: (p: PendingRecovery) => void;
  clear: () => void;
}

export const useRecovery = create<RecoveryState>((set) => ({
  pending: null,
  show: (pending) => set({ pending }),
  clear: () => set({ pending: null }),
}));
