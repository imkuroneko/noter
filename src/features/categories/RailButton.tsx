import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { cn } from "../../lib/cn";

interface Props {
  label: string;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  /** Sin matiz usa el color de acento (botón "Todas las notas"). */
  hue?: number;
  children: ReactNode;
}

/**
 * Círculo que pasa a cuadrado redondeado al hover o al estar activo,
 * con la barrita a la izquierda cuando la categoría está activa.
 */
export function RailButton({ label, active, onClick, onContextMenu, hue, children }: Props) {
  const style = hue === undefined ? undefined : ({ "--ch": hue } as CSSProperties);
  return (
    <div className="relative flex w-[60px] justify-center">
      {active && <div className="absolute top-[11px] left-0 h-5 w-1 rounded-r bg-fg" />}
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        title={label}
        onClick={onClick}
        onContextMenu={onContextMenu}
        style={style}
        className={cn(
          "flex size-[42px] items-center justify-center outline-none text-[20px] font-bold transition-[border-radius,background-color,color] duration-150 hover:rounded-[14px]",
          active ? "rounded-[14px]" : "rounded-[21px]",
          hue === undefined
            ? cn(
                "hover:bg-accent hover:text-onaccent",
                active ? "bg-accent text-onaccent" : "bg-hover text-fg",
              )
            : cn(
                "hover:bg-[hsl(var(--ch)_65%_64%)] hover:text-[hsl(var(--ch)_50%_10%)]",
                active
                  ? "bg-[hsl(var(--ch)_65%_64%)] text-[hsl(var(--ch)_50%_10%)]"
                  : "bg-[hsl(var(--ch)_var(--tint-s)_var(--tint-l))] text-fg",
              ),
        )}
      >
        {children}
      </button>
    </div>
  );
}
