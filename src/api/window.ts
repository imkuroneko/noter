import { getCurrentWindow } from "@tauri-apps/api/window";

export type Unlisten = () => void;

export const windowMinimize = () => getCurrentWindow().minimize();

export const windowToggleMaximize = () => getCurrentWindow().toggleMaximize();

export const windowIsMaximized = () => getCurrentWindow().isMaximized();

/** Cierra la ventana sin pasar por onCloseRequested (el guardado ya se hizo antes). */
export const windowDestroy = () => getCurrentWindow().destroy();

export const onWindowResized = (handler: () => void): Promise<Unlisten> =>
  getCurrentWindow().onResized(() => handler());

/** Intercepta el cierre (botón, Alt+F4): el handler debe llamar a preventDefault y cerrar él mismo. */
export const onCloseRequested = (handler: (event: { preventDefault: () => void }) => void): Promise<Unlisten> =>
  getCurrentWindow().onCloseRequested((event) => handler(event));
