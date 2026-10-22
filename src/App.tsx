import { useEffect } from "react";
import { ConfirmHost } from "./components/ConfirmHost";
import { ContextMenuHost } from "./components/ContextMenuHost";
import { Toast } from "./components/Toast";
import { CategoryRail } from "./features/categories/CategoryRail";
import { EditCategoryPopover } from "./features/categories/EditCategoryPopover";
import { NewCategoryPopover } from "./features/categories/NewCategoryPopover";
import { EditorPane } from "./features/editor/EditorPane";
import { NoteListPanel } from "./features/notes/NoteListPanel";
import { installGlobalInput } from "./features/menus/globalInput";
import { TitleBar } from "./features/window/TitleBar";
import { ThemePopover } from "./features/vault/ThemePopover";
import { VaultPopover } from "./features/vault/VaultPopover";
import { useNotes } from "./stores/notes";
import { useVaults } from "./stores/vaults";

export default function App() {
  useEffect(() => {
    const { init, flush } = useNotes.getState();
    void init();
    void useVaults.getState().load();
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
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-main text-fg">
      <TitleBar />
      {/* Los popovers se posicionan contra esta área, que queda bajo la barra de título. */}
      <div className="relative flex min-h-0 flex-1">
        <CategoryRail />
        <NoteListPanel />
        <EditorPane />
        <EditCategoryPopover />
        <NewCategoryPopover />
        <ThemePopover />
        <VaultPopover />
        <Toast />
      </div>
      <ContextMenuHost />
      <ConfirmHost />
    </div>
  );
}
