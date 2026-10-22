import { SHEET_COLS, SHEET_ROWS, emojiPosition, getSpritesheetURL } from "../lib/emoji";

interface Props {
  /** Emoji como texto Unicode, tal como se guarda en la base. */
  native: string;
  /** Tamaño CSS; por defecto hereda el del texto. */
  size?: string;
}

/**
 * Dibuja un emoji con la hoja de imágenes empaquetada (mismo aspecto en todos los sistemas).
 * No usa el elemento <em-emoji> de emoji-mart: sin una opción que ese elemento no expone, pide
 * cada imagen a internet, y la política de contenido de la app lo bloquea.
 */
export function Emoji({ native, size = "1em" }: Props) {
  const pos = emojiPosition(native);
  // Si el conjunto no trae ese emoji (uno más nuevo), se muestra como texto del sistema.
  if (!pos) return <span aria-hidden="true">{native}</span>;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        verticalAlign: "-0.15em",
        flex: "none",
        backgroundImage: `url(${getSpritesheetURL()})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${100 * SHEET_COLS}% ${100 * SHEET_ROWS}%`,
        backgroundPosition: `${(100 / (SHEET_COLS - 1)) * pos.x}% ${(100 / (SHEET_ROWS - 1)) * pos.y}%`,
      }}
    />
  );
}
