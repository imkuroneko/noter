import { useEffect, useRef } from "react";

interface Props {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  label: string;
}

/** Casilla real con estado intermedio (para "algunas notas del grupo"). */
export function IndeterminateCheckbox({ checked, indeterminate, onChange, label }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={onChange}
      className="size-4 flex-none accent-[var(--accent)]"
    />
  );
}
