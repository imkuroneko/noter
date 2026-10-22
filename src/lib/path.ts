/** Carpeta que contiene el archivo (acepta / y \). */
export function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : path;
}

/** Acorta una ruta larga por el medio: "C:\Usuarios\…\Notas". */
export function truncateMiddle(text: string, max = 34): string {
  if (text.length <= max) return text;
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  return `${text.slice(0, head)}…${text.slice(text.length - (keep - head))}`;
}
