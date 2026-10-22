import { useCallback, useEffect, useState } from "react";

/** Cuenta atrás de espera tras demasiados intentos fallidos. */
export function useThrottle() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [until]);

  const start = useCallback((seconds: number) => {
    const t = Date.now();
    setNow(t);
    setUntil(t + seconds * 1000);
  }, []);

  return { remaining: Math.max(0, Math.ceil((until - now) / 1000)), start };
}
