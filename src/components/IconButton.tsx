import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  children: ReactNode;
}

/** Botón cuadrado de 30px solo con icono; el nombre accesible es `label` y el tooltip, `title` o `label`. */
export function IconButton({ label, title, children, className, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cn(
        "flex size-[30px] flex-none items-center justify-center rounded-lg enabled:hover:bg-hover disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
