import { cn } from "../lib/cn";

interface Option<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (id: T) => void;
  /** "fill" reparte el ancho entre los botones (selector de tema). */
  fill?: boolean;
}

export function SegmentedControl<T extends string>({ label, options, value, onChange, fill }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-none gap-0.5 rounded-[9px] bg-rail p-[3px]">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "rounded-[7px] font-semibold",
              fill ? "h-7 flex-1 text-center text-[12.5px]" : "h-[26px] px-3 text-xs",
              on ? "bg-accent text-onaccent" : "text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
