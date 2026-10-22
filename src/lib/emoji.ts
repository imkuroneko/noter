import data from "@emoji-mart/data/sets/15/twitter.json";
import { init } from "emoji-mart";
import sheetUrl from "emoji-datasource-twitter/img/twitter/sheets-256/64.png?url";

/** Conjunto único de emoji (Twemoji): se dibuja igual en cualquier sistema operativo. */
export const EMOJI_SET = "twitter";
export const emojiData = data;
export const getSpritesheetURL = (): string => sheetUrl;

interface SheetData {
  sheet: { cols: number; rows: number };
  emojis: Record<string, { skins: { native: string; x: number; y: number }[] }>;
}
const sheetData = data as unknown as SheetData;

export const SHEET_COLS = sheetData.sheet.cols;
export const SHEET_ROWS = sheetData.sheet.rows;

/** Sin el selector de variación (U+FE0F), para que "🛠️" y "🛠" se encuentren igual. */
const plain = (s: string): string => s.replace(/️/g, "");

const positions = new Map<string, { x: number; y: number }>();
for (const emoji of Object.values(sheetData.emojis)) {
  for (const skin of emoji.skins) positions.set(plain(skin.native), { x: skin.x, y: skin.y });
}

/** Posición del emoji dentro de la hoja de imágenes; undefined si el conjunto no lo trae. */
export function emojiPosition(native: string): { x: number; y: number } | undefined {
  return positions.get(plain(native));
}

/**
 * Registra los datos y la hoja de imágenes (empaquetada, sin internet) para el selector.
 * Llamar una vez antes del primer render.
 */
export function initEmoji(): Promise<void> {
  return init({ data, set: EMOJI_SET, spritesheet: true, getSpritesheetURL }) as Promise<void>;
}
