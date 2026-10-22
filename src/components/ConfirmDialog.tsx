import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { cn } from "../lib/cn";
import type { ConfirmOptions } from "../stores/confirm";

interface Props extends ConfirmOptions {
  onResult: (ok: boolean) => void;
}

/** Diálogo modal de confirmación. El foco empieza en el botón seguro ("Cancelar"). */
export function ConfirmDialog({ title, message, confirmLabel, danger, onResult }: Props) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onResult(false);
    } else if (e.key === "Tab") {
      // Foco atrapado entre los dos botones.
      e.preventDefault();
      const next = document.activeElement === cancelRef.current ? confirmRef.current : cancelRef.current;
      next?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onResult(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex w-[380px] max-w-full flex-col gap-3 rounded-[14px] border border-line bg-side p-5 shadow-[0_16px_40px_rgba(0,0,0,.4)]"
      >
        <h2 id={titleId} className="text-[15px] font-bold">
          {title}
        </h2>
        <p id={descId} className="text-[13px] leading-normal text-muted">
          {message}
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onResult(false)}
            className="h-8 rounded-lg bg-rail px-3.5 text-[12.5px] font-semibold hover:bg-hover"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onResult(true)}
            className={cn(
              "h-8 rounded-lg px-3.5 text-[12.5px] font-semibold",
              danger ? "bg-danger text-ondanger" : "bg-accent text-onaccent",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
