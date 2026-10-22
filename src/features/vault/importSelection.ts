import type { ImportCategory, ImportNote, ImportPreview } from "../../api";

export interface ImportGroup {
  /** null = notas sin categoría. */
  category: ImportCategory | null;
  /** Notas del grupo que pasan el filtro de búsqueda. */
  notes: ImportNote[];
}

const norm = (s: string) => s.toLowerCase();

export function matchesQuery(note: ImportNote, query: string): boolean {
  const q = norm(query.trim());
  if (!q) return true;
  return norm(note.title).includes(q) || norm(note.snippet).includes(q) || note.tags.some((t) => norm(t).includes(q));
}

/** Agrupa las notas por categoría de origen ("Sin categoría" al final) y aplica el filtro de texto. */
export function groupNotes(preview: ImportPreview, query: string): ImportGroup[] {
  const visible = preview.notes.filter((n) => matchesQuery(n, query));
  const groups: ImportGroup[] = preview.categories.map((category) => ({
    category,
    notes: visible.filter((n) => n.categoryId === category.id),
  }));
  groups.push({ category: null, notes: visible.filter((n) => n.categoryId === null) });
  return groups.filter((g) => g.notes.length > 0);
}

export type CheckState = "all" | "some" | "none";

export function checkState(notes: ImportNote[], selected: ReadonlySet<number>): CheckState {
  const count = notes.reduce((n, note) => n + (selected.has(note.id) ? 1 : 0), 0);
  return count === 0 ? "none" : count === notes.length ? "all" : "some";
}
