import { useState } from "react";
import * as api from "../../api";
import { Modal } from "../../components/Modal";
import { useUi } from "../../stores/ui";
import { ImportDoneStep } from "./ImportDoneStep";
import { ImportFileStep } from "./ImportFileStep";
import { ImportPickStep } from "./ImportPickStep";

type Step = "file" | "pick" | "done";

const TITLES: Record<Step, string> = {
  file: "Importar notas: elegir archivo",
  pick: "Importar notas: elegir qué traer",
  done: "Importación lista",
};

/**
 * Importa notas desde la bóveda de otra persona. Contraseña y vista previa viven solo en el estado
 * de este componente: al cerrarlo (o al bloquearse la bóveda, que cierra el diálogo) se descartan.
 */
export function ImportDialog() {
  const close = () => useUi.getState().setVaultDialog(null);
  const [step, setStep] = useState<Step>("file");
  const [path, setPath] = useState<string | null>(null);
  const [info, setInfo] = useState<api.ImportInfo | null>(null);
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<api.ImportPreview | null>(null);
  const [result, setResult] = useState<api.ImportResult | null>(null);

  return (
    <Modal title={TITLES[step]} onClose={close} width={640}>
      {step === "file" && (
        <ImportFileStep
          path={path}
          info={info}
          password={password}
          onPassword={setPassword}
          onPicked={(p, i) => {
            setPath(p);
            setInfo(i);
          }}
          onPreview={(pv) => {
            setPreview(pv);
            setStep("pick");
          }}
          onCancel={close}
        />
      )}
      {step === "pick" && path && preview && (
        <ImportPickStep
          path={path}
          password={info?.encrypted ? password : undefined}
          preview={preview}
          onBack={() => {
            setPreview(null);
            setStep("file");
          }}
          onDone={(r) => {
            // Ya no hace falta nada de la bóveda de origen.
            setPassword("");
            setPreview(null);
            setResult(r);
            setStep("done");
          }}
        />
      )}
      {step === "done" && result && <ImportDoneStep result={result} onClose={close} />}
    </Modal>
  );
}
