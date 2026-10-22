import { Emoji } from "../../components/Emoji";
import { lazy, Suspense } from "react";
import { arrowNav } from "../../lib/useDismiss";
import { SectionLabel } from "../../components/SectionLabel";
import { HUES } from "./options";

// Los datos de emoji pesan bastante: se cargan solo al abrir el selector.
const EmojiPicker = lazy(() => import("./EmojiPicker").then((m) => ({ default: m.EmojiPicker })));

interface Props {
  emoji: string;
  hue: number;
  onEmoji: (emoji: string) => void;
  onHue: (hue: number) => void;
}

export function EmojiHuePicker({ emoji, hue, onEmoji, onHue }: Props) {
  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>Emoji</SectionLabel>
        <span aria-label={`Emoji elegido: ${emoji}`} className="text-lg leading-none">
          <Emoji native={emoji} />
        </span>
      </div>
      <Suspense fallback={<div className="flex h-[300px] items-center justify-center text-xs text-muted">Cargando emojis…</div>}>
        <EmojiPicker onSelect={onEmoji} />
      </Suspense>
      <SectionLabel>Color</SectionLabel>
      <div
        role="group"
        aria-label="Color de la categoría"
        onKeyDown={(e) => arrowNav(e, "button", 8)}
        className="grid grid-cols-8 gap-1"
      >
        {HUES.map((h) => {
          const on = h === hue;
          const color = `hsl(${h} 65% 64%)`;
          return (
            <button
              key={h}
              type="button"
              aria-pressed={on}
              aria-label={`Color ${h}`}
              onClick={() => onHue(h)}
              className="flex h-[26px] items-center justify-center"
            >
              <span
                className="size-5 rounded-full"
                style={{
                  background: color,
                  boxShadow: on ? `0 0 0 2px var(--side), 0 0 0 4px ${color}` : "none",
                }}
              />
            </button>
          );
        })}
      </div>
    </>
  );
}
