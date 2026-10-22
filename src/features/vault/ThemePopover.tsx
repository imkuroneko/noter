import { Popover } from "../../components/Popover";
import { SectionLabel } from "../../components/SectionLabel";
import { SegmentedControl } from "../../components/SegmentedControl";
import { arrowNav } from "../../lib/useDismiss";
import { PALETTES } from "../../theme/palettes";
import { useTheme } from "../../theme/useTheme";

const SCHEMES = [
  { id: "light", label: "Claro" },
  { id: "dark", label: "Oscuro" },
] as const;

export function ThemePopover() {
  const dark = useTheme((s) => s.dark);
  const palette = useTheme((s) => s.palette);
  const setDark = useTheme((s) => s.setDark);
  const setPalette = useTheme((s) => s.setPalette);
  return (
    <Popover id="theme" label="Tema" className="bottom-[60px] left-[68px] w-[256px]">
      <SectionLabel>Apariencia</SectionLabel>
      <SegmentedControl
        fill
        label="Claro u oscuro"
        options={SCHEMES}
        value={dark ? "dark" : "light"}
        onChange={(id) => setDark(id === "dark")}
      />
      <SectionLabel>Paleta</SectionLabel>
      <div
        role="group"
        aria-label="Paleta de color"
        onKeyDown={(e) => arrowNav(e, "button", 5)}
        className="grid grid-cols-5 gap-1.5"
      >
        {PALETTES.map((p) => {
          const on = p.id === palette;
          const color = `hsl(${p.hue} 70% 62%)`;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              aria-label={p.id}
              title={p.id}
              onClick={() => setPalette(p.id)}
              className="flex flex-col items-center gap-[5px] py-0.5"
            >
              <span
                className="size-[30px] rounded-full"
                style={{
                  background: color,
                  boxShadow: on ? `0 0 0 2px var(--side), 0 0 0 4px ${color}` : "none",
                }}
              />
              <span className="text-[10.5px] text-muted">{p.id}</span>
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
