import { create } from "zustand";

export type EditorMode = "edit" | "split" | "view";
export type PopoverId = "category-edit" | "category-new" | "theme" | "tags" | "vault";

const MODE_KEY = "noter.mode";

function loadMode(): EditorMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "edit" || v === "split" || v === "view") return v;
  } catch {
    // Sin almacenamiento: se usa el predeterminado.
  }
  return "split";
}

interface UiState {
  mode: EditorMode;
  /** Solo hay un popover abierto a la vez. */
  popover: PopoverId | null;
  /** Aviso breve para errores de acciones (fijar, mover a la papelera, etc.). */
  notice: string | null;
  /** El próximo editor que se monte toma el foco. */
  pendingFocus: boolean;
  setMode: (mode: EditorMode) => void;
  togglePopover: (id: PopoverId) => void;
  openPopover: (id: PopoverId) => void;
  closePopover: (id?: PopoverId) => void;
  showNotice: (message: string) => void;
  clearNotice: () => void;
  requestEditorFocus: () => void;
  consumeEditorFocus: () => boolean;
}

export const useUi = create<UiState>((set, get) => ({
  mode: loadMode(),
  popover: null,
  notice: null,
  pendingFocus: false,
  setMode: (mode) => {
    set({ mode });
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // Se ignora: el modo solo vale para esta sesión.
    }
  },
  togglePopover: (id) => set((s) => ({ popover: s.popover === id ? null : id })),
  openPopover: (id) => set({ popover: id }),
  closePopover: (id) => set((s) => (id === undefined || s.popover === id ? { popover: null } : s)),
  showNotice: (notice) => set({ notice }),
  clearNotice: () => set({ notice: null }),
  requestEditorFocus: () => set({ pendingFocus: true }),
  consumeEditorFocus: () => {
    const pending = get().pendingFocus;
    if (pending) set({ pendingFocus: false });
    return pending;
  },
}));
