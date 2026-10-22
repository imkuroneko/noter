import { useEffect } from "react";
import * as api from "../../api";
import { useVaults } from "../../stores/vaults";

const MIN_INTERVAL = 10_000;

/** Avisa al backend de la actividad (reinicia el reloj de inactividad), como máximo cada 10 s. */
export function useActivityPing() {
  useEffect(() => {
    let last = 0;
    const ping = () => {
      const { locked, vaults, activeId } = useVaults.getState();
      // Solo las bóvedas protegidas se bloquean por inactividad.
      if (locked || !vaults.find((v) => v.id === activeId)?.encrypted) return;
      const now = Date.now();
      if (now - last < MIN_INTERVAL) return;
      last = now;
      void api.vaultTouch().catch(() => undefined);
    };
    const events = ["pointerdown", "keydown", "wheel"] as const;
    for (const ev of events) document.addEventListener(ev, ping, { capture: true, passive: true });
    window.addEventListener("focus", ping);
    return () => {
      for (const ev of events) document.removeEventListener(ev, ping, { capture: true });
      window.removeEventListener("focus", ping);
    };
  }, []);
}
