import { useEffect, useMemo, useState } from "react";
import { fullDate, timeAgo } from "../../lib/date";
import { countChars, countWords, formatCount } from "../../lib/stats";
import { useNotes } from "../../stores/notes";

/** Se vuelve a calcular "hace X" cada pocos segundos mientras se muestra. */
function useNow(active: boolean, everyMs = 5000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [active, everyMs]);
  return now;
}

export function StatusBar() {
  const body = useNotes((s) => s.body);
  const status = useNotes((s) => s.saveStatus);
  const error = useNotes((s) => s.saveError);
  const updatedAt = useNotes((s) => s.currentNote?.updatedAt ?? null);
  const [words, chars] = useMemo(() => [countWords(body), countChars(body)], [body]);
  const now = useNow(status === "saved" && updatedAt !== null);

  return (
    <div className="box-border flex h-[26px] flex-none cursor-default items-center justify-between border-t border-line bg-side px-4 text-[11.5px] text-muted select-none">
      <span className="tabular-nums">
        {formatCount(words)} {words === 1 ? "palabra" : "palabras"} · {formatCount(chars)}{" "}
        {chars === 1 ? "carácter" : "caracteres"}
      </span>
      <span className="flex gap-3.5">
        <span>Markdown</span>
        <span
          role="status"
          aria-live={status === "saved" ? "off" : "polite"}
          className={status === "error" ? "text-accent" : undefined}
          title={updatedAt !== null ? fullDate(updatedAt) : undefined}
        >
          {status === "saving" && "Guardando…"}
          {status === "saved" && (updatedAt !== null ? `Guardado ${timeAgo(updatedAt, now)}` : "Guardado")}
          {status === "error" && `No se pudo guardar: ${error ?? "error desconocido"}. Reintentando…`}
        </span>
      </span>
    </div>
  );
}
