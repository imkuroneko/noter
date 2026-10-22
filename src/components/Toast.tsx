import { useEffect } from "react";
import { X } from "lucide-react";
import { useUi } from "../stores/ui";

export function Toast() {
  const notice = useUi((s) => s.notice);
  const clear = useUi((s) => s.clearNotice);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(clear, 6000);
    return () => window.clearTimeout(t);
  }, [notice, clear]);

  if (!notice) return null;
  return (
    <div
      role="alert"
      className="absolute bottom-10 left-1/2 z-30 flex max-w-[420px] -translate-x-1/2 items-center gap-3 rounded-[10px] border border-line bg-side py-2 pr-2 pl-3.5 text-[12.5px] shadow-[0_12px_28px_rgba(0,0,0,.32)]"
    >
      <span>{notice}</span>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={clear}
        className="flex size-6 flex-none items-center justify-center rounded-md hover:bg-hover"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
