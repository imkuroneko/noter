import { useEffect, type KeyboardEvent, type RefObject } from "react";
import { useUi, type PopoverId } from "../stores/ui";

/**
 * Cierra el popover con Escape (devolviendo el foco a su botón) o al hacer clic fuera.
 * El botón que lo abre lleva data-popover-trigger="<id>" y se encarga de alternarlo.
 */
export function useDismiss(id: PopoverId, ref: RefObject<HTMLElement | null>): boolean {
  const open = useUi((s) => s.popover === id);
  const close = useUi((s) => s.closePopover);

  useEffect(() => {
    if (!open) return;
    const selector = `[data-popover-trigger="${id}"]`;
    const onDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      // Los menús contextuales que nacen del popover no lo cierran.
      if (target && (ref.current?.contains(target) || target.closest(selector) || target.closest("[role='menu']"))) return;
      close(id);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close(id);
      document.querySelector<HTMLElement>(selector)?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, id, ref, close]);

  return open;
}

/** Flechas, Inicio y Fin para moverse entre los elementos de un grupo. `cols` activa la rejilla. */
export function arrowNav(e: KeyboardEvent<HTMLElement>, selector: string, cols = 1) {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(selector));
  const i = items.findIndex((el) => el === document.activeElement);
  if (i < 0) return;
  const grid = cols > 1;
  let next = -1;
  switch (e.key) {
    case "ArrowDown":
      next = i + cols;
      break;
    case "ArrowUp":
      next = i - cols;
      break;
    case "ArrowRight":
      if (grid) next = i + 1;
      break;
    case "ArrowLeft":
      if (grid) next = i - 1;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = items.length - 1;
      break;
    default:
      return;
  }
  if (next < 0 && grid && e.key === "ArrowUp") return;
  e.preventDefault();
  items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
}
