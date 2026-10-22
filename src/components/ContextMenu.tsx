import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import { clampToViewport } from "../lib/position";
import { arrowNav } from "../lib/useDismiss";
import type { MenuItem, MenuSpec } from "../stores/menu";

interface Props {
  spec: MenuSpec;
  onClose: () => void;
}

const BACK_ID = "__back";
const BACK: MenuItem = { id: BACK_ID, label: "Atrás" };
const TITLE_BAR_HEIGHT = 36;
const ITEM = "[role='menuitem']";

export function ContextMenu({ spec, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const [path, setPath] = useState<MenuItem[][]>([]);
  const [pos, setPos] = useState({ x: spec.x, y: spec.y });

  const items = path.length > 0 ? [BACK, ...path[path.length - 1]] : spec.items;

  const closeAndRestore = () => {
    onClose();
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
  };

  // Reposiciona si el menú se sale de la ventana.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Los menús nunca se meten bajo la barra de título.
    const p = clampToViewport({ x: spec.x, y: spec.y }, r.width, r.height, window.innerWidth, window.innerHeight);
    setPos({ x: p.x, y: Math.max(p.y, TITLE_BAR_HEIGHT + 8) });
  }, [spec, path]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`${ITEM}:not([aria-disabled='true'])`)?.focus();
  }, [path]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && ref.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const choose = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.id === BACK_ID) {
      setPath((p) => p.slice(0, -1));
    } else if (item.submenu) {
      const sub = item.submenu;
      setPath((p) => [...p, sub]);
    } else {
      closeAndRestore();
      item.onSelect?.();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (path.length > 0) setPath((p) => p.slice(0, -1));
      else closeAndRestore();
    } else if (e.key === "ArrowLeft" && path.length > 0) {
      e.preventDefault();
      setPath((p) => p.slice(0, -1));
    } else if (e.key === "Tab") {
      e.preventDefault();
      closeAndRestore();
    } else {
      arrowNav(e, ITEM);
    }
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={spec.label}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 flex max-h-[calc(100vh-52px)] max-w-[280px] min-w-[200px] flex-col overflow-y-auto rounded-[10px] border border-line bg-side p-1 shadow-[0_12px_28px_rgba(0,0,0,.32)]"
    >
      {items.map((item) => (
        <div key={item.id} role="none" className={cn(item.separatorBefore && "mt-1 border-t border-line pt-1")}>
          <button
            type="button"
            role="menuitem"
            aria-disabled={item.disabled || undefined}
            title={item.hint}
            aria-haspopup={item.submenu ? "menu" : undefined}
            // El menú no roba el foco ni la selección del editor al pulsar.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(item)}
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[12.5px] focus-visible:outline-offset-[-2px]",
              item.disabled ? "opacity-50" : "hover:bg-hover focus:bg-hover",
              item.danger && "text-danger",
            )}
          >
            {item.id === BACK_ID && <ChevronLeft size={14} aria-hidden="true" />}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.checked && <Check size={14} aria-hidden="true" />}
            {item.submenu && <ChevronRight size={14} aria-hidden="true" />}
          </button>
        </div>
      ))}
    </div>
  );
}
