import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** "new-password" en los campos de creación; "off" en el resto. */
  autoComplete?: "off" | "new-password";
  autoFocus?: boolean;
  disabled?: boolean;
  describedBy?: string;
}

/** Campo de contraseña con etiqueta y botón de mostrar u ocultar. El valor vive solo en el estado del formulario. */
export function PasswordField({ label, value, onChange, autoComplete = "off", autoFocus, disabled, describedBy }: Props) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold">
        {label}
      </label>
      <div className="box-border flex h-11 items-center gap-2 rounded-[10px] border border-line bg-rail pr-1 pl-3.5 focus-within:border-accent">
        <input
          id={id}
          data-autofocus={autoFocus ? "" : undefined}
          type={show ? "text" : "password"}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="off"
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent text-fg outline-none"
        />
        <button
          type="button"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
          className="flex size-9 flex-none items-center justify-center rounded-lg text-muted hover:bg-hover"
        >
          {show ? <EyeOff size={17} strokeWidth={1.8} aria-hidden="true" /> : <Eye size={17} strokeWidth={1.8} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
