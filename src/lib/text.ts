const MARK_OPEN = "\u0002";
const MARK_CLOSE = "\u0003";

export interface Segment {
  text: string;
  mark: boolean;
}

/** Convierte las marcas \u0002 / \u0003 del backend en segmentos; el texto nunca se interpreta como HTML. */
export function parseMarks(text: string): Segment[] {
  const out: Segment[] = [];
  let mark = false;
  let buf = "";
  for (const ch of text) {
    if (ch === MARK_OPEN || ch === MARK_CLOSE) {
      if (buf) out.push({ text: buf, mark });
      buf = "";
      mark = ch === MARK_OPEN;
    } else {
      buf += ch;
    }
  }
  if (buf) out.push({ text: buf, mark });
  return out;
}

/** Quita la sintaxis Markdown del inicio de un cuerpo para mostrarlo como extracto de una línea. */
export function cleanSnippet(raw: string, title: string): string {
  let text = raw
    .split(/\r?\n/)
    .filter((l) => !/^\s*(```|~~~)/.test(l) && !/^\s*([-*_]\s*){3,}$/.test(l))
    .map((l) =>
      l
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*>+\s?/, "")
        .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "")
        .replace(/^\s*[-*+]\s+/, "")
        .replace(/^\s*\d+[.)]\s+/, ""),
    )
    .join(" ");
  text = text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|`|\*|(?<![\w])_|_(?![\w]))/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // El cuerpo suele empezar con el título: no repetirlo en el extracto.
  if (title && text.startsWith(title)) text = text.slice(title.length).trim();
  return text;
}

/**
 * Título de la nota: la primera línea "# ..." del cuerpo; si no existe,
 * la primera línea con texto. Si el cuerpo está vacío, el título queda vacío.
 */
export function deriveTitle(body: string): string {
  let firstLine = "";
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const h1 = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (h1) return h1[1].trim().slice(0, 200);
    if (!firstLine && line.trim()) firstLine = line;
  }
  return firstLine
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/^\s*[-*+>]\s+(\[[ xX]\]\s+)?/, "")
    .replace(/[*_`~]/g, "")
    .trim()
    .slice(0, 200);
}
