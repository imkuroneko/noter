import { create } from "zustand";

export interface MenuItem {
  id: string;
  label: string;
  onSelect?: () => void;
  /** Si trae submenú, al elegirlo se muestra esa lista dentro del mismo menú. */
  submenu?: MenuItem[];
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  separatorBefore?: boolean;
}

export interface MenuSpec {
  x: number;
  y: number;
  label: string;
  items: MenuItem[];
}

interface MenuState {
  menu: MenuSpec | null;
  open: (menu: MenuSpec) => void;
  close: () => void;
}

export const useMenu = create<MenuState>((set) => ({
  menu: null,
  open: (menu) => set({ menu }),
  close: () => set({ menu: null }),
}));
