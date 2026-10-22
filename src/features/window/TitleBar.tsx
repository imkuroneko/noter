import { useEffect, useState, type ReactNode } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import * as api from "../../api";
import appIcon from "../../assets/app-icon.svg";
import { cn } from "../../lib/cn";
import { requestClose } from "./closeFlow";

function WindowButton({
  label,
  onClick,
  close,
  children,
}: {
  label: string;
  onClick: () => void;
  close?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-9 w-[46px] flex-none items-center justify-center",
        close ? "hover:bg-danger hover:text-ondanger" : "hover:bg-hover hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

/** Barra de título propia (la ventana no tiene decoraciones nativas). */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let alive = true;
    const sync = () => void api.windowIsMaximized().then((m) => alive && setMaximized(m));
    sync();
    const unlistenResize = api.onWindowResized(sync);
    // Alt+F4 y el cierre del sistema pasan por el mismo flujo de guardado.
    const unlistenClose = api.onCloseRequested((e) => {
      e.preventDefault();
      void requestClose();
    });
    return () => {
      alive = false;
      void unlistenResize.then((un) => un());
      void unlistenClose.then((un) => un());
    };
  }, []);

  return (
    <header
      data-tauri-drag-region
      className="box-border flex h-9 flex-none items-center justify-between border-b border-line bg-rail text-muted"
    >
      <div data-tauri-drag-region className="flex items-center gap-2 pl-3">
        <img data-tauri-drag-region src={appIcon} alt="" width={18} height={18} draggable={false} />
        <span data-tauri-drag-region className="text-[12.5px] font-semibold">
          Noter
        </span>
      </div>
      {/* El doble clic sobre la región de arrastre alterna maximizar (lo hace Tauri). */}
      <div className="flex">
        <WindowButton label="Minimizar" onClick={() => void api.windowMinimize()}>
          <Minus size={14} strokeWidth={1.5} aria-hidden="true" />
        </WindowButton>
        <WindowButton
          label={maximized ? "Restaurar" : "Maximizar"}
          onClick={() => void api.windowToggleMaximize()}
        >
          {maximized ? (
            <Copy size={14} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Square size={14} strokeWidth={1.5} aria-hidden="true" />
          )}
        </WindowButton>
        <WindowButton label="Cerrar" close onClick={() => void requestClose()}>
          <X size={14} strokeWidth={1.5} aria-hidden="true" />
        </WindowButton>
      </div>
    </header>
  );
}
