import { useNotes } from "../../stores/notes";

/** Nombre de la categoría activa, o "Todas las notas". */
export function useCategoryLabel(): string {
  return useNotes((s) => s.categories.find((c) => c.id === s.categoryId)?.name ?? "Todas las notas");
}
