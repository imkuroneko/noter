import { useEffect, useRef } from "react";
import i18n from "@emoji-mart/data/i18n/es.json";
import { Picker } from "emoji-mart";
import { EMOJI_SET, emojiData, getSpritesheetURL } from "../../lib/emoji";
import { useTheme } from "../../theme/useTheme";

interface Props {
  onSelect: (emoji: string) => void;
}

/** Color calculado de un token CSS como "r, g, b" (lo que espera emoji-mart). */
function rgbOf(host: HTMLElement, token: string): string | null {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  host.appendChild(probe);
  const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(getComputedStyle(probe).color);
  probe.remove();
  return m ? `${m[1]}, ${m[2]}, ${m[3]}` : null;
}

/**
 * Selector de emoji con búsqueda y categorías en español. Todo es local: datos y hoja de
 * imágenes Twemoji van empaquetados (ver lib/emoji.ts), sin pedir nada a internet.
 */
export function EmojiPicker({ onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onSelect);
  const dark = useTheme((s) => s.dark);

  useEffect(() => {
    callback.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const picker = new Picker({
      data: emojiData,
      i18n,
      locale: "es",
      set: EMOJI_SET,
      getSpritesheetURL,
      theme: dark ? "dark" : "light",
      dynamicWidth: false,
      perLine: 8,
      emojiButtonSize: 34,
      emojiSize: 22,
      maxFrequentRows: 1,
      previewPosition: "none",
      skinTonePosition: "search",
      autoFocus: false,
      onEmojiSelect: (e: { native: string }) => callback.current(e.native),
    }) as unknown as HTMLElement;

    const vars: [string, string][] = [
      ["--rgb-color", "--text"],
      ["--rgb-accent", "--accent"],
      ["--rgb-background", "--side"],
      ["--rgb-input", "--rail"],
    ];
    for (const [name, token] of vars) {
      const rgb = rgbOf(container, token);
      if (rgb) picker.style.setProperty(name, rgb);
    }
    const line = rgbOf(container, "--line");
    if (line) {
      picker.style.setProperty("--color-border", `rgb(${line})`);
      picker.style.setProperty("--color-border-over", `rgb(${line})`);
    }
    picker.style.setProperty("--font-family", "Figtree, system-ui, sans-serif");
    picker.style.setProperty("--shadow", "none");
    picker.style.width = "100%";
    picker.style.height = "300px";
    container.appendChild(picker);
    return () => picker.remove();
  }, [dark]);

  return <div ref={host} className="w-full" />;
}
