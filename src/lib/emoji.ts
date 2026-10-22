import data from "@emoji-mart/data/sets/15/twitter.json";
import { init } from "emoji-mart";
import sheetUrl from "emoji-datasource-twitter/img/twitter/sheets-256/64.png?url";

/** Conjunto único de emoji (Twemoji): se dibuja igual en cualquier sistema operativo. */
export const EMOJI_SET = "twitter";
export const emojiData = data;
export const getSpritesheetURL = (): string => sheetUrl;

/**
 * Registra los datos y la hoja de imágenes (empaquetada, sin internet) para el selector
 * y para el elemento <em-emoji>. Llamar una vez antes del primer render.
 */
export function initEmoji(): Promise<void> {
  return init({ data, set: EMOJI_SET, getSpritesheetURL }) as Promise<void>;
}
