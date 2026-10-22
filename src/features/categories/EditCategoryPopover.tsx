import { Popover } from "../../components/Popover";
import { useNotes } from "../../stores/notes";
import { EmojiHuePicker } from "./EmojiHuePicker";

export function EditCategoryPopover() {
  const category = useNotes((s) => s.categories.find((c) => c.id === s.categoryId));
  const update = useNotes((s) => s.updateCategory);
  if (!category) return null;
  return (
    <Popover id="category-edit" label="Personalizar categoría" className="top-[52px] left-[72px] w-[340px]">
      <EmojiHuePicker
        emoji={category.emoji}
        hue={category.hue}
        onEmoji={(emoji) => void update(category.id, { emoji })}
        onHue={(hue) => void update(category.id, { hue })}
      />
    </Popover>
  );
}
