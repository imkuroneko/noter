import { createElement } from "react";
import { EMOJI_SET } from "../lib/emoji";

interface Props {
  /** Emoji como texto Unicode, tal como se guarda en la base. */
  native: string;
  /** Tamaño CSS; por defecto hereda el del texto. */
  size?: string;
}

/** Dibuja un emoji con el conjunto empaquetado (mismo aspecto en todos los sistemas). */
export function Emoji({ native, size = "1em" }: Props) {
  return createElement("em-emoji", { native, set: EMOJI_SET, size, "aria-hidden": "true" });
}
