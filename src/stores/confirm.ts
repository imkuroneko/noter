import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  /** Pinta el botón de confirmar con el color de peligro. */
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

interface ConfirmState {
  pending: Pending | null;
  answer: (ok: boolean) => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  pending: null,
  answer: (ok) => {
    get().pending?.resolve(ok);
    set({ pending: null });
  },
}));

/** Abre el diálogo de confirmación y resuelve true solo si la persona confirma. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // Si ya había una pregunta abierta, se cancela.
  useConfirm.getState().pending?.resolve(false);
  return new Promise((resolve) => useConfirm.setState({ pending: { ...options, resolve } }));
}
