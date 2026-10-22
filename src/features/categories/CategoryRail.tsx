import { Emoji } from "../../components/Emoji";
import { Layers, Plus, Trash2 } from "lucide-react";
import { useMenu } from "../../stores/menu";
import { useNotes } from "../../stores/notes";
import { useUi } from "../../stores/ui";
import { categoryMenuItems } from "../menus/menuItems";
import { RailButton } from "./RailButton";

export function CategoryRail() {
  const categories = useNotes((s) => s.categories);
  const categoryId = useNotes((s) => s.categoryId);
  const trashMode = useNotes((s) => s.trashMode);
  const trashCount = useNotes((s) => s.trash.length);
  const setCategory = useNotes((s) => s.setCategory);
  const openTrash = useNotes((s) => s.openTrash);
  const togglePopover = useUi((s) => s.togglePopover);
  const newOpen = useUi((s) => s.popover === "category-new");
  const openMenu = useMenu((s) => s.open);

  return (
    <nav aria-label="Categorías" className="flex w-[60px] flex-none flex-col items-center gap-2 overflow-y-auto bg-rail py-3">
      <RailButton
        label="Todas las notas"
        active={categoryId === "all" && !trashMode}
        onClick={() => void setCategory("all")}
      >
        <Layers size={20} strokeWidth={1.8} aria-hidden="true" />
      </RailButton>
      <div className="h-0.5 w-7 flex-none rounded-[1px] bg-line" />
      {categories.map((c) => (
        <RailButton
          key={c.id}
          label={c.name}
          hue={c.hue}
          active={categoryId === c.id && !trashMode}
          onClick={() => void setCategory(c.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            openMenu({
              x: e.clientX,
              y: e.clientY,
              label: `Acciones de ${c.name}`,
              items: categoryMenuItems(c),
            });
          }}
        >
          <Emoji native={c.emoji} />
        </RailButton>
      ))}
      <button
        type="button"
        data-popover-trigger="category-new"
        aria-label="Nueva categoría"
        aria-expanded={newOpen}
        title="Nueva categoría"
        onClick={() => togglePopover("category-new")}
        className="flex size-[42px] flex-none items-center justify-center rounded-[21px] border-[1.5px] border-dashed border-line transition-[border-radius,background-color,color] duration-150 hover:rounded-[14px] hover:bg-accent hover:text-onaccent"
      >
        <Plus size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <div className="relative mt-auto">
        <RailButton label="Papelera" active={trashMode} onClick={() => void openTrash()}>
          <Trash2 size={19} strokeWidth={1.8} aria-hidden="true" />
        </RailButton>
        {trashCount > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-4 font-bold text-onaccent"
          >
            {trashCount > 99 ? "99+" : trashCount}
          </span>
        )}
      </div>
    </nav>
  );
}
