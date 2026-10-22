import { useEffect, useState, type FormEvent } from "react";
import { describeError } from "../../api";
import { Popover } from "../../components/Popover";
import { SectionLabel } from "../../components/SectionLabel";
import { useNotes } from "../../stores/notes";
import { useUi } from "../../stores/ui";
import { EmojiHuePicker } from "./EmojiHuePicker";
import { DEFAULT_EMOJI, HUES } from "./options";

export function NewCategoryPopover() {
  const open = useUi((s) => s.popover === "category-new");
  const close = useUi((s) => s.closePopover);
  const create = useNotes((s) => s.createCategory);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>(DEFAULT_EMOJI);
  const [hue, setHue] = useState<number>(HUES[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setEmoji(DEFAULT_EMOJI);
      setError(null);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await create({ name: name.trim(), emoji, hue });
      close("category-new");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover id="category-new" label="Nueva categoría" className="top-[52px] left-[72px] w-[340px]">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <SectionLabel>Nombre</SectionLabel>
        <input
          data-autofocus
          aria-label="Nombre de la categoría"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="Por ejemplo, Proyectos"
          className="h-8 rounded-lg border border-line bg-rail px-2.5 text-fg"
        />
        <EmojiHuePicker emoji={emoji} hue={hue} onEmoji={setEmoji} onHue={setHue} />
        {error && (
          <p role="alert" className="text-xs text-accent">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || name.trim() === ""}
          className="h-8 rounded-lg bg-accent text-[12.5px] font-semibold text-onaccent text-center disabled:opacity-50"
        >
          Crear categoría
        </button>
      </form>
    </Popover>
  );
}
