export interface Palette {
  id: string;
  hue: number;
}

export const PALETTES: readonly Palette[] = [
  { id: "Malva", hue: 265 },
  { id: "Musgo", hue: 150 },
  { id: "Brasa", hue: 20 },
  { id: "Océano", hue: 195 },
  { id: "Rosa", hue: 335 },
];

export const DEFAULT_PALETTE = "Malva";
