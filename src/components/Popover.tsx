import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { useDismiss } from "../lib/useDismiss";
import type { PopoverId } from "../stores/ui";

interface Props {
  id: PopoverId;
  label: string;
  /** Posición y ancho, por ejemplo "left-[72px] top-[52px] w-[252px]". */
  className: string;
  children: ReactNode;
}

/** Panel flotante: se cierra con Escape o al hacer clic fuera, y toma el foco al abrirse. */
export function Popover({ id, label, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const open = useDismiss(id, ref);

  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    const target =
      root?.querySelector<HTMLElement>("[data-autofocus]") ??
      root?.querySelector<HTMLElement>("[aria-pressed='true']") ??
      root?.querySelector<HTMLElement>("button, input");
    target?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={cn(
        "absolute z-20 box-border flex flex-col gap-3 rounded-[14px] border border-line bg-side p-3.5 shadow-[0_12px_32px_rgba(0,0,0,.32)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
