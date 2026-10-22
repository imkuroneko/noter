import { FolderOpen, ScanSearch } from "lucide-react";
import * as api from "../../api";
import { Button } from "../../components/Button";
import { PasswordField } from "../../components/PasswordField";
import { dirname, truncateMiddle } from "../../lib/path";
import { useSubmit } from "./useSubmit";

interface Props {
  path: string | null;
  info: api.ImportInfo | null;
  password: string;
  onPassword: (value: string) => void;
  onPicked: (path: string, info: api.ImportInfo) => void;
  onPreview: (preview: api.ImportPreview) => void;
  onCancel: () => void;
}

const fileName = (path: string) => path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);

/** Paso 1: elegir el archivo .db y, si está protegido, escribir su contraseña. */
export function ImportFileStep({ path, info, password, onPassword, onPicked, onPreview, onCancel }: Props) {
  const { busy, error, run } = useSubmit();

  const pick = () =>
    run(async () => {
      const chosen = await api.pickVaultFile();
      if (!chosen) return;
      onPassword("");
      onPicked(chosen, await api.importInspect(chosen));
    });

  const view = () =>
    run(async () => {
      if (!path || !info) return;
      onPreview(await api.importPreview(path, info.encrypted ? password : undefined));
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void view();
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-[13px] leading-normal text-muted">
        Elige el archivo .db de la bóveda de la que quieres traer notas. La bóveda original no se modifica ni se agrega
        a tu lista.
      </p>
      <div className="flex items-center gap-3">
        <Button variant="secondary" icon={FolderOpen} onClick={() => void pick()} disabled={busy} data-autofocus>
          {path ? "Elegir otro archivo…" : "Elegir archivo…"}
        </Button>
        {path && info && (
          <div className="min-w-0 flex-1" title={path}>
            <div className="truncate text-[13px] font-semibold">{fileName(path)}</div>
            <div className="truncate text-xs text-muted">{truncateMiddle(dirname(path), 48)}</div>
          </div>
        )}
      </div>

      {info?.encrypted && (
        <div className="flex flex-col gap-2">
          <PasswordField label={`Contraseña de «${info.name}»`} value={password} onChange={onPassword} disabled={busy} describedBy="import-help" autoFocus />
          <p id="import-help" className="text-xs text-muted">
            Escribe la contraseña de esa bóveda. Debe estar su archivo .keys.json en la misma carpeta.
          </p>
        </div>
      )}

      <div aria-live="polite" className="min-h-4 text-xs text-danger">
        {error}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          icon={ScanSearch}
          loading={busy && !!path}
          disabled={!path || !info || (info.encrypted && password === "")}
        >
          Ver contenido
        </Button>
      </div>
    </form>
  );
}
