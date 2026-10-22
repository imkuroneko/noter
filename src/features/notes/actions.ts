import type { Category } from "../../api";
import { confirmAction } from "../../stores/confirm";
import { useNotes } from "../../stores/notes";

const shown = (title: string) => (title.trim() ? `«${title.trim()}»` : "esta nota sin título");

export async function trashNoteWithConfirm(id: number, title: string): Promise<void> {
  const ok = await confirmAction({
    title: "Mover a la papelera",
    message: `¿Mover ${shown(title)} a la papelera? Podrás restaurarla desde la papelera.`,
    confirmLabel: "Mover a la papelera",
    danger: true,
  });
  if (ok) await useNotes.getState().trashNote(id);
}

export async function trashManyWithConfirm(ids: number[]): Promise<void> {
  const ok = await confirmAction({
    title: "Mover a la papelera",
    message: `¿Mover ${ids.length} notas a la papelera? Podrás restaurarlas desde la papelera.`,
    confirmLabel: "Mover a la papelera",
    danger: true,
  });
  if (ok) await useNotes.getState().trashMany(ids);
}

export async function deleteCategoryWithConfirm(category: Category): Promise<void> {
  const ok = await confirmAction({
    title: "Eliminar categoría",
    message: `¿Eliminar la categoría ${category.emoji} «${category.name}»? Sus notas no se borran: quedarán sin categoría.`,
    confirmLabel: "Eliminar categoría",
    danger: true,
  });
  if (ok) await useNotes.getState().deleteCategory(category.id);
}

export async function purgeNoteWithConfirm(id: number, title: string): Promise<void> {
  const ok = await confirmAction({
    title: "Eliminar definitivamente",
    message: `¿Eliminar ${shown(title)} para siempre? Esta acción no se puede deshacer.`,
    confirmLabel: "Eliminar definitivamente",
    danger: true,
  });
  if (ok) await useNotes.getState().purgeNote(id);
}

export async function emptyTrashWithConfirm(count: number): Promise<void> {
  const ok = await confirmAction({
    title: "Vaciar la papelera",
    message: `¿Eliminar para siempre ${count === 1 ? "la 1 nota" : `las ${count} notas`} de la papelera? Esta acción no se puede deshacer.`,
    confirmLabel: "Vaciar papelera",
    danger: true,
  });
  if (ok) await useNotes.getState().emptyTrash();
}
