import type { ComponentProps, ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ComponentProps<"button"> {
  variant?: Variant;
  /** sm 32px, md 36px, lg 44px. */
  size?: Size;
  icon?: LucideIcon;
  /** Pone el icono después del texto (por ejemplo "Continuar →"). */
  iconAfter?: boolean;
  /** Muestra un indicador y el texto de `loadingLabel`, y deshabilita el botón. */
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-onaccent enabled:hover:brightness-110",
  secondary: "bg-rail text-fg enabled:hover:bg-hover",
  ghost: "bg-transparent text-muted enabled:hover:bg-hover enabled:hover:text-fg",
  danger: "bg-danger text-ondanger enabled:hover:brightness-110",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[12.5px]",
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-4 text-sm",
};

const ICON_SIZE: Record<Size, number> = { sm: 14, md: 15, lg: 17 };

/** Botón de acción. El contenido siempre va centrado (la regla global alinea los botones a la izquierda). */
export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconAfter,
  loading,
  loadingLabel = "Verificando…",
  fullWidth,
  disabled,
  type = "button",
  className,
  children,
  ...rest
}: Props) {
  const iconEl = loading ? (
    <Loader2 size={ICON_SIZE[size]} aria-hidden="true" className="animate-spin" />
  ) : Icon ? (
    <Icon size={ICON_SIZE[size]} strokeWidth={1.9} aria-hidden="true" />
  ) : null;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex flex-none items-center justify-center gap-2 rounded-[10px] text-center font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50",
        SIZES[size],
        VARIANTS[variant],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {!iconAfter && iconEl}
      <span>{loading ? loadingLabel : children}</span>
      {iconAfter && iconEl}
    </button>
  );
}
