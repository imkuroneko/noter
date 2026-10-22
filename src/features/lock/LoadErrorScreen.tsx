import { RotateCcw } from "lucide-react";
import { Button } from "../../components/Button";
import { useNotes } from "../../stores/notes";
import { useVaults } from "../../stores/vaults";

/** No se pudo leer el estado de las bóvedas al arrancar: mensaje claro y reintento. */
export function LoadErrorScreen({ message }: { message: string }) {
  const retry = async () => {
    const ok = await useVaults.getState().load();
    if (ok) await useNotes.getState().reset();
  };
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-rail p-6 text-center">
      <h1 className="text-xl font-bold">No se pudo abrir la bóveda</h1>
      <p role="alert" className="max-w-[460px] text-sm leading-normal text-muted">
        {message}
      </p>
      <Button variant="primary" icon={RotateCcw} onClick={() => void retry()}>
        Reintentar
      </Button>
    </main>
  );
}
