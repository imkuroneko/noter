import { Emoji } from "../../components/Emoji";
import { ChevronDown, Plus } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { useNotes } from "../../stores/notes";
import { useUi } from "../../stores/ui";
import { useCategoryLabel } from "./useCategoryLabel";

export function NoteListHeader() {
  const category = useNotes((s) => s.categories.find((c) => c.id === s.categoryId));
  const count = useNotes((s) => s.list.length);
  const create = useNotes((s) => s.createNote);
  const toggle = useUi((s) => s.togglePopover);
  const editOpen = useUi((s) => s.popover === "category-edit");
  const label = useCategoryLabel();

  return (
    <div className="box-border flex h-12 flex-none items-center justify-between border-b border-line pr-2 pl-3.5">
      <div className="flex min-w-0 items-baseline gap-2">
        {category ? (
          <button
            type="button"
            data-popover-trigger="category-edit"
            aria-expanded={editOpen}
            aria-label="Personalizar categoría"
            title="Elegir emoji y color"
            onClick={() => toggle("category-edit")}
            className="-ml-2 flex h-[30px] items-center gap-1.5 rounded-lg px-2 text-[15px] font-bold whitespace-nowrap hover:bg-hover"
          >
            <span><Emoji native={category.emoji} /></span>
            <span>{label}</span>
            <ChevronDown size={12} strokeWidth={2.4} aria-hidden="true" className="text-muted" />
          </button>
        ) : (
          <span className="text-[15px] font-bold whitespace-nowrap">{label}</span>
        )}
        <span className="text-xs whitespace-nowrap text-muted">
          {count} {count === 1 ? "nota" : "notas"}
        </span>
      </div>
      <IconButton label="Nueva nota" onClick={() => void create()}>
        <Plus size={16} strokeWidth={2} aria-hidden="true" />
      </IconButton>
    </div>
  );
}
