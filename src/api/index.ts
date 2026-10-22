import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { appDataDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { Category, ListParams, Note, NoteSummary, TagCount, ImportInfo, ImportOptions, ImportPreview, ImportResult, TrashNote, VaultCreated, VaultProtected, VaultStatus } from "./types";

export type * from "./types";
export { describeError, throttleSeconds } from "./errors";
export * from "./window";

export const categoryList = () => invoke<Category[]>("category_list");

export const categoryCreate = (args: { name: string; emoji: string; hue: number }) =>
  invoke<Category>("category_create", args);

export const categoryUpdate = (args: { id: number; name?: string; emoji?: string; hue?: number }) =>
  invoke<Category>("category_update", args);

export const categoryDelete = (id: number) => invoke<void>("category_delete", { id });

export const noteList = (params: ListParams) => invoke<NoteSummary[]>("note_list", { params });

export const noteGet = (id: number) => invoke<Note>("note_get", { id });

export const noteCreate = (categoryId?: number) => invoke<Note>("note_create", { categoryId });

/** Devuelve el nuevo updatedAt (epoch ms). */
export const noteUpdate = (id: number, title: string, body: string) =>
  invoke<number>("note_update", { id, title, body });

export const noteMove = (id: number, categoryId: number | null) =>
  invoke<void>("note_move", { id, categoryId });

/** Mueve varias notas a la papelera en una sola transacción; devuelve cuántas se movieron. */
export const noteTrashMany = (ids: number[]) => invoke<number>("note_trash_many", { ids });

export const notePin = (id: number, pinned: boolean) => invoke<void>("note_pin", { id, pinned });

export const noteTrash = (id: number) => invoke<void>("note_trash", { id });

export const trashList = () => invoke<TrashNote[]>("trash_list");

export const noteRestore = (id: number) => invoke<void>("note_restore", { id });

/** Borrado definitivo de una nota que ya está en la papelera. */
export const notePurge = (id: number) => invoke<void>("note_purge", { id });

/** Devuelve cuántas notas se borraron. */
export const trashEmpty = () => invoke<number>("trash_empty");

export const vaultList = () => invoke<VaultStatus>("vault_list");

/** Crea la bóveda sin cambiar a ella. La contraseña es opcional. */
export const vaultCreate = (name: string, password?: string, folder?: string) =>
  invoke<VaultCreated>("vault_create", { name, password, folder });

/** Agrega a la lista una bóveda que ya existe (archivo .db). No cambia de bóveda. */
export const vaultOpenExisting = (path: string) => invoke<VaultStatus>("vault_open_existing", { path });

/** Apunta la bóveda `id` a otro archivo .db (no sirve con la bóveda abierta). */
export const vaultRelocate = (id: string, path: string) => invoke<VaultStatus>("vault_relocate", { id, path });

/** Quita la bóveda de la lista sin borrar archivos. */
export const vaultForget = (id: string) => invoke<VaultStatus>("vault_forget", { id });

export async function pickFolder(): Promise<string | null> {
  const r = await open({ directory: true, multiple: false, title: "Elige una carpeta" });
  return typeof r === "string" ? r : null;
}

export async function pickVaultFile(): Promise<string | null> {
  const r = await open({
    multiple: false,
    directory: false,
    title: "Abrir una bóveda",
    filters: [{ name: "Bóveda de Noter", extensions: ["db"] }],
  });
  return typeof r === "string" ? r : null;
}

/** Muestra el archivo en el explorador del sistema. */
export const revealPath = (path: string) => revealItemInDir(path);

export const vaultRename = (id: string, name: string) => invoke<VaultStatus>("vault_rename", { id, name });

export const vaultSwitch = (id: string) => invoke<VaultStatus>("vault_switch", { id });

export const vaultUnlock = (id: string, password: string) => invoke<VaultStatus>("vault_unlock", { id, password });

export const vaultLock = () => invoke<VaultStatus>("vault_lock");

/** Protege con contraseña la bóveda activa (que no la tenía). */
export const vaultProtect = (password: string) => invoke<VaultProtected>("vault_protect", { password });

export const vaultChangePassword = (id: string, oldPassword: string, newPassword: string) =>
  invoke<void>("vault_change_password", { id, oldPassword, newPassword });

export const vaultRecover = (id: string, recoveryKey: string, newPassword: string) =>
  invoke<VaultStatus>("vault_recover", { id, recoveryKey, newPassword });

export const vaultSetIdle = (minutes: number) => invoke<VaultStatus>("vault_set_idle", { minutes });

/** Sobrescribe con ceros y borra una copia sin cifrar. */
export const vaultDeleteBackup = (file: string) => invoke<VaultStatus>("vault_delete_backup", { file });

/** Revisa un archivo .db ajeno sin leer su contenido ni pedir contraseña. */
export const importInspect = (path: string) => invoke<ImportInfo>("import_inspect", { path });

/** Lista el contenido de la bóveda ajena (trabaja sobre una copia temporal). */
export const importPreview = (path: string, password?: string) =>
  invoke<ImportPreview>("import_preview", { path, password });

export const importRun = (path: string, password: string | undefined, options: ImportOptions) =>
  invoke<ImportResult>("import_run", { path, password, options });

/** Avisa al backend de que hubo actividad (reinicia el reloj de inactividad). */
export const vaultTouch = () => invoke<void>("vault_touch");

/** Bloqueo automático iniciado por el backend (por inactividad). */
export const onVaultLocked = (handler: () => void): Promise<() => void> =>
  listen("vault://locked", () => handler());

/** Carpeta de datos de la app, o null si no se puede obtener. */
export async function dataFolder(): Promise<string | null> {
  try {
    return await appDataDir();
  } catch {
    return null;
  }
}

export const tagList = (categoryId?: number) => invoke<TagCount[]>("tag_list", { categoryId });

export const noteSetTags = (noteId: number, names: string[]) =>
  invoke<string[]>("note_set_tags", { noteId, names });

/** Abre un enlace en el navegador del sistema; solo http, https y mailto. */
export async function openExternal(url: string): Promise<void> {
  if (/^(https?:|mailto:)/i.test(url)) await openUrl(url);
}
