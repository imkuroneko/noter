import { create } from "zustand";
import { DEFAULT_PALETTE, PALETTES } from "./palettes";

const KEY = "noter.theme";

interface ThemeValue {
  dark: boolean;
  palette: string;
}

interface ThemeState extends ThemeValue {
  setDark: (dark: boolean) => void;
  setPalette: (palette: string) => void;
}

function load(): ThemeValue {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v: unknown = JSON.parse(raw);
      if (typeof v === "object" && v !== null) {
        const { dark, palette } = v as Partial<ThemeValue>;
        if (typeof dark === "boolean" && PALETTES.some((p) => p.id === palette)) {
          return { dark, palette: palette as string };
        }
      }
    }
  } catch {
    // Valor corrupto: se usa el predeterminado.
  }
  return {
    dark: window.matchMedia("(prefers-color-scheme: dark)").matches,
    palette: DEFAULT_PALETTE,
  };
}

function apply({ dark, palette }: ThemeValue) {
  const hue = (PALETTES.find((p) => p.id === palette) ?? PALETTES[0]).hue;
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.style.setProperty("--h", String(hue));
}

function persist({ dark, palette }: ThemeValue) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ dark, palette }));
  } catch {
    // Sin almacenamiento: el tema vale solo para esta sesión.
  }
}

const initial = load();
apply(initial);

export const useTheme = create<ThemeState>((set, get) => ({
  ...initial,
  setDark: (dark) => {
    set({ dark });
    apply(get());
    persist(get());
  },
  setPalette: (palette) => {
    set({ palette });
    apply(get());
    persist(get());
  },
}));
