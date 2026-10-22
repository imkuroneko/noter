import { useEffect } from "react";
import * as api from "./api";
import { ConfirmHost } from "./components/ConfirmHost";
import { ContextMenuHost } from "./components/ContextMenuHost";
import { Toast } from "./components/Toast";
import { CategoryRail } from "./features/categories/CategoryRail";
import { EditCategoryPopover } from "./features/categories/EditCategoryPopover";
import { NewCategoryPopover } from "./features/categories/NewCategoryPopover";
import { EditorPane } from "./features/editor/EditorPane";
import { NoteListPanel } from "./features/notes/NoteListPanel";
import { installGlobalInput } from "./features/menus/globalInput";
import { LoadErrorScreen } from "./features/lock/LoadErrorScreen";
import { UnavailableScreen } from "./features/lock/UnavailableScreen";
import { LockScreen } from "./features/lock/LockScreen";
import { useActivityPing } from "./features/lock/useActivityPing";
import { VaultDialogHost } from "./features/vault/VaultDialogHost";
import { TitleBar } from "./features/window/TitleBar";
import { ThemePopover } from "./features/vault/ThemePopover";
import { VaultPopover } from "./features/vault/VaultPopover";
import { useNotes } from "./stores/notes";
import { useVaults } from "./stores/vaults";

export default function App() {
  const loaded = useVaults((s) => s.loaded);
  const locked = useVaults((s) => s.locked);
  const loadError = useVaults((s) => s.loadError);
  // Sin bloqueo y sin bóveda abierta: la activa no se pudo abrir (falta su archivo, disco desconectado...).
  const activeMissing = useVaults((s) => s.loaded && !s.locked && !s.open);
  useActivityPing();

  useEffect(() => {
    const { init, flush } = useNotes.getState();
    // Primero se lee el estado de las bóvedas: si está bloqueada no se cargan notas.
    void useVaults
      .getState()
      .load()
      .then((unlocked) => {
        if (unlocked) void init();
      });
    const unlistenLocked = api.onVaultLocked(() => void useVaults.getState().handleLocked());
    const removeGlobalInput = installGlobalInput();
    // Guardado inmediato al perder el foco o al salir; el autoguardado cubre el resto.
    const save = () => void flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("blur", save);
    window.addEventListener("beforeunload", save);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", save);
      window.removeEventListener("beforeunload", save);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onVisibility);
      removeGlobalInput();
      void unlistenLocked.then((un) => un());
    };
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-main text-fg">
      <TitleBar />
      {/* Los popovers se posicionan contra esta área, que queda bajo la barra de título. */}
      {!loaded ? (
        <div className="flex-1" />
      ) : loadError ? (
        <LoadErrorScreen message={loadError} />
      ) : locked ? (
        <LockScreen />
      ) : activeMissing ? (
        <UnavailableScreen />
      ) : (
        <div className="relative flex min-h-0 flex-1">
          <CategoryRail />
          <NoteListPanel />
          <EditorPane />
          <EditCategoryPopover />
          <NewCategoryPopover />
          <ThemePopover />
          <VaultPopover />
        </div>
      )}
      <Toast />
      <VaultDialogHost />
      <ContextMenuHost />
      <ConfirmHost />
    </div>
  );
}
