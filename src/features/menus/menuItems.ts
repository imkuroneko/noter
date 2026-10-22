import type { Category, NoteSummary } from "../../api";
import type { MenuItem } from "../../stores/menu";
import { useNotes } from "../../stores/notes";
import { useUi } from "../../stores/ui";
import { deleteCategoryWithConfirm, trashManyWithConfirm, trashNoteWithConfirm } from "../notes/actions";

/** Menú de una nota o, si hay varias seleccionadas, de todas ellas. */
export function noteMenuItems(notes: NoteSummary[], categories: Category[]): MenuItem[] {
  const { pinNotes, moveNotes } = useNotes.getState();
  const ids = notes.map((n) => n.id);
  const many = notes.length > 1;
  const allPinned = notes.every((n) => n.pinned);
  const sameCategory = notes.every((n) => n.categoryId === notes[0].categoryId);
  const current = sameCategory ? notes[0].categoryId : undefined;
  const pinLabel = allPinned ? "Desfijar" : "Fijar";
  return [
    {
      id: "pin",
      label: many ? `${pinLabel} ${notes.length} notas` : pinLabel,
      onSelect: () => void pinNotes(ids, !allPinned),
    },
    {
      id: "move",
      label: "Mover a categoría",
      submenu: [
        {
          id: "move-none",
          label: "Sin categoría",
          checked: current === null,
          onSelect: () => void moveNotes(ids, null),
        },
        ...categories.map((c) => ({
          id: `move-${c.id}`,
          label: `${c.emoji}  ${c.name}`,
          checked: current === c.id,
          onSelect: () => void moveNotes(ids, c.id),
        })),
      ],
    },
    {
      id: "trash",
      label: many ? `Mover a la papelera ${notes.length} notas` : "Mover a la papelera",
      danger: true,
      separatorBefore: true,
      onSelect: () => void (many ? trashManyWithConfirm(ids) : trashNoteWithConfirm(notes[0].id, notes[0].title)),
    },
  ];
}

export function categoryMenuItems(category: Category): MenuItem[] {
  return [
    {
      id: "edit",
      label: "Personalizar",
      onSelect: () => {
        void useNotes
          .getState()
          .setCategory(category.id)
          .then(() => useUi.getState().openPopover("category-edit"));
      },
    },
    {
      id: "delete",
      label: "Eliminar categoría",
      danger: true,
      separatorBefore: true,
      onSelect: () => void deleteCategoryWithConfirm(category),
    },
  ];
}
