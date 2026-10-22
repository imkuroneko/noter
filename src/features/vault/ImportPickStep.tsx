import { useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import * as api from "../../api";
import { Button } from "../../components/Button";
import { Emoji } from "../../components/Emoji";
import { IndeterminateCheckbox } from "../../components/IndeterminateCheckbox";
import { relativeDate } from "../../lib/date";
import { plural } from "../../lib/plural";
import { cleanSnippet } from "../../lib/text";
import { useNotes } from "../../stores/notes";
import { useUi } from "../../stores/ui";
import { checkState, groupNotes } from "./importSelection";
import { useSubmit } from "./useSubmit";

interface Props {
  path: string;
  /** Contraseña de la bóveda de origen (solo si es protegida). */
  password: string | undefined;
  preview: api.ImportPreview;
  onBack: () => void;
  onDone: (result: api.ImportResult) => void;
}

const PAGE = 200;

/** Paso 2: elegir qué notas importar y cómo. */
export function ImportPickStep({ path, password, preview, onBack, onDone }: Props) {
  const myCategories = useNotes((s) => s.categories);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set(preview.notes.map((n) => n.id)));
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [keep, setKeep] = useState(true);
  const [target, setTarget] = useState<number | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const { busy, error, run } = useSubmit();

  const groups = useMemo(() => groupNotes(preview, query), [preview, query]);
  const visibleCount = groups.reduce((n, g) => n + g.notes.length, 0);

  // Solo se dibujan las primeras `limit` notas visibles; "Mostrar más" amplía.
  const shown = useMemo(() => {
    let left = limit;
    return groups.map((g) => {
      const notes = g.notes.slice(0, Math.max(0, left));
      left -= notes.length;
      return { ...g, shown: notes };
    });
  }, [groups, limit]);

  const setMany = (ids: number[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) (on ? next.add(id) : next.delete(id));
      return next;
    });

  const allVisible = groups.flatMap((g) => g.notes.map((n) => n.id));
  const count = selected.size;

  const submit = async () => {
    const ok = await run(async () => {
      const result = await api.importRun(path, password, {
        noteIds: [...selected],
        keepCategories: keep,
        targetCategoryId: keep ? null : target,
        skipDuplicates,
      });
      await useNotes.getState().refreshAfterImport();
      const parts = [`Se importaron ${plural(result.imported, "nota", "notas")}`];
      if (result.skippedDuplicates > 0) parts.push(`${plural(result.skippedDuplicates, "repetida omitida", "repetidas omitidas")}`);
      useUi.getState().showNotice(`${parts.join("; ")}.`);
      onDone(result);
    });
    return ok;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Buscar en las notas de origen"
          placeholder="Buscar por título, texto o etiqueta"
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          className="box-border h-8 min-w-[180px] flex-1 rounded-lg border border-line bg-rail px-2.5 text-[12.5px] text-fg"
        />
        <Button variant="ghost" size="sm" onClick={() => setMany(allVisible, true)}>
          Seleccionar todo
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMany(allVisible, false)}>
          Ninguna
        </Button>
      </div>

      <div aria-live="polite" className="text-xs text-muted">
        {count} de {preview.notes.length} notas seleccionadas
        {preview.totalNotes > preview.notes.length &&
          ` · Se muestran las primeras ${preview.notes.length} de ${preview.totalNotes} notas`}
      </div>

      <div className="max-h-[min(320px,38vh)] overflow-y-auto rounded-[10px] border border-line">
        {visibleCount === 0 && <p className="p-4 text-center text-xs text-muted">Ninguna nota coincide con la búsqueda.</p>}
        {shown.map((g) => {
          const state = checkState(g.notes, selected);
          const name = g.category?.name ?? "Sin categoría";
          return (
            <section key={g.category?.id ?? "none"} aria-label={name}>
              <label className="sticky top-0 z-[1] flex items-center gap-2 border-b border-line bg-side px-3 py-1.5 text-[12.5px] font-semibold">
                <IndeterminateCheckbox
                  label={`Seleccionar todas las notas de ${name}`}
                  checked={state === "all"}
                  indeterminate={state === "some"}
                  onChange={() => setMany(g.notes.map((n) => n.id), state !== "all")}
                />
                {g.category && <Emoji native={g.category.emoji} />}
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <span className="text-xs font-normal text-muted">{g.notes.length}</span>
              </label>
              {g.shown.map((n) => (
                <label key={n.id} className="flex cursor-default items-start gap-2.5 px-3 py-2 hover:bg-hover">
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    onChange={(e) => setMany([n.id], e.target.checked)}
                    className="mt-0.5 size-4 flex-none accent-[var(--accent)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline gap-2">
                      <span className={n.title ? "truncate text-[13px] font-semibold" : "truncate text-[13px] text-muted italic"}>
                        {n.title || "Sin título"}
                      </span>
                      <span className="ml-auto flex-none text-[11px] text-muted">{relativeDate(n.updatedAt)}</span>
                    </span>
                    <span className="truncate text-xs text-muted">{cleanSnippet(n.snippet, n.title)}</span>
                    {n.tags.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {n.tags.map((t) => (
                          <span key={t} className="rounded-full bg-soft px-2 text-[11px] text-accent">
                            #{t}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </section>
          );
        })}
        {visibleCount > limit && (
          <div className="flex justify-center p-2">
            <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              Mostrar más ({visibleCount - limit} restantes)
            </Button>
          </div>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold">Categorías</legend>
        <label className="flex items-start gap-2 text-[13px]">
          <input type="radio" name="import-cats" checked={keep} onChange={() => setKeep(true)} className="mt-0.5 accent-[var(--accent)]" />
          <span>
            Conservar sus categorías
            <span className="block text-xs text-muted">
              Si ya tienes una categoría con el mismo nombre, se junta con ella; si no, se crea.
            </span>
          </span>
        </label>
        <label className="flex flex-wrap items-center gap-2 text-[13px]">
          <input type="radio" name="import-cats" checked={!keep} onChange={() => setKeep(false)} className="accent-[var(--accent)]" />
          <span>Poner todas en una de mis categorías</span>
          <select
            aria-label="Mi categoría de destino"
            disabled={keep}
            value={target ?? ""}
            onChange={(e) => setTarget(e.target.value === "" ? null : Number(e.target.value))}
            className="h-8 rounded-lg border border-line bg-rail px-2 text-[12.5px] text-fg disabled:opacity-50"
          >
            <option value="">Sin categoría</option>
            {myCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <label className="flex items-start gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={skipDuplicates}
          onChange={(e) => setSkipDuplicates(e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--accent)]"
        />
        <span>
          Omitir notas que ya tengo
          <span className="block text-xs text-muted">Se consideran repetidas las que tienen el mismo título y el mismo texto.</span>
        </span>
      </label>

      <div aria-live="polite" className="min-h-4 text-xs text-danger">
        {error}
      </div>
      <div className="flex justify-between gap-2">
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack} disabled={busy}>
          Volver
        </Button>
        <Button variant="primary" icon={Download} loading={busy} loadingLabel="Importando…" disabled={count === 0} onClick={() => void submit()}>
          Importar {plural(count, "nota", "notas")}
        </Button>
      </div>
    </div>
  );
}
