import { parseMarks } from "../lib/text";

/** Texto con marcas de búsqueda del backend, resaltadas con <mark>. React escapa el contenido. */
export function Marked({ text }: { text: string }) {
  return (
    <>
      {parseMarks(text).map((s, i) =>
        s.mark ? (
          <mark key={i} className="rounded-sm bg-soft text-accent">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
