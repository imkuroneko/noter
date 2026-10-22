import { useEffect, useRef } from "react";
import { Check, ChevronDown, Tag } from "lucide-react";
import { cn } from "../../lib/cn";
import { arrowNav, useDismiss } from "../../lib/useDismiss";
import { useNotes } from "../../stores/notes";
import { useUi } from "../../stores/ui";

export function TagFilter() {
  const tags = useNotes((s) => s.tags);
  const tagsError = useNotes((s) => s.tagsError);
  const selected = useNotes((s) => s.selectedTagIds);
  const toggleTag = useNotes((s) => s.toggleTag);
  const clearTags = useNotes((s) => s.clearTags);
  const toggle = useUi((s) => s.togglePopover);
  const boxRef = useRef<HTMLDivElement>(null);
  const open = useDismiss("tags", boxRef);

  useEffect(() => {
    if (!open) return;
    const root = boxRef.current;
    (
      root?.querySelector<HTMLElement>("[role='option'][aria-selected='true']") ??
      root?.querySelector<HTMLElement>("[role='option']")
    )?.focus();
  }, [open]);

  const count = selected.length;
  const label = count === 0 ? "Todas las etiquetas" : count === 1 ? "1 etiqueta" : `${count} etiquetas`;

  return (
    <div ref={boxRef} className="relative flex gap-1.5 px-2.5 pt-1 pb-2.5">
      <button
        type="button"
        data-popover-trigger="tags"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filtrar por etiqueta"
        onClick={() => toggle("tags")}
        className={cn(
          "flex h-[30px] min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 text-[12.5px] font-medium",
          count > 0 ? "border-accent bg-soft text-accent" : "border-transparent bg-rail text-muted",
        )}
      >
        <Tag size={14} strokeWidth={1.9} aria-hidden="true" className="flex-none" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown size={12} strokeWidth={2.4} aria-hidden="true" className="flex-none" />
      </button>
      {count > 0 && (
        <button
          type="button"
          onClick={clearTags}
          className="h-[30px] flex-none rounded-lg px-2.5 text-xs font-semibold text-muted hover:bg-hover"
        >
          Limpiar
        </button>
      )}
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="Etiquetas"
          onKeyDown={(e) => arrowNav(e, "[role='option']")}
          className="absolute top-[38px] right-2.5 left-2.5 z-10 flex max-h-[214px] flex-col gap-px overflow-y-auto rounded-[10px] border border-line bg-side p-1 shadow-[0_12px_28px_rgba(0,0,0,.32)]"
        >
          {tags.length === 0 && (
            <div role="presentation" className="px-2 py-2 text-xs text-muted">
              {tagsError ? "No se pudieron cargar las etiquetas." : "Aún no hay etiquetas en esta categoría."}
            </div>
          )}
          {tags.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggleTag(t.id)}
                className={cn(
                  "flex h-[30px] flex-none items-center gap-[9px] rounded-md px-2 text-[12.5px] text-fg hover:bg-hover",
                  on && "bg-soft",
                )}
              >
                <span
                  className={cn(
                    "box-border flex size-4 flex-none items-center justify-center rounded-[5px] border-[1.5px] text-onaccent",
                    on ? "border-accent bg-accent" : "border-muted",
                  )}
                >
                  {on && <Check size={10} strokeWidth={3.5} aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1 truncate">#{t.name}</span>
                <span className="text-[11.5px] text-muted tabular-nums">{t.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
