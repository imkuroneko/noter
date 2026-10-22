import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  /** Sin onClose el diálogo no se puede cerrar con Escape ni con clic fuera. */
  onClose?: () => void;
  width?: number;
}

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Diálogo modal: foco atrapado, foco inicial en [data-autofocus], y devuelve el foco al cerrar. */
export function Modal({ title, children, onClose, width = 420 }: Props) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = ref.current;
    (root?.querySelector<HTMLElement>("[data-autofocus]") ?? root?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (onClose) onClose();
    } else if (e.key === "Tab") {
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ width }}
        className="flex max-h-full max-w-full flex-col gap-3 overflow-y-auto rounded-[14px] border border-line bg-side p-5 shadow-[0_16px_40px_rgba(0,0,0,.4)]"
      >
        <h2 id={titleId} className="text-[15px] font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
