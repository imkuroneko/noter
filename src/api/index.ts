import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Category, ListParams, Note, NoteSummary, TagCount, TrashNote, VaultList } from "./types";

export type * from "./types";
export { describeError } from "./errors";
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

export const vaultList = () => invoke<VaultList>("vault_list");

/** Crea la bóveda sin cambiar a ella. */
export const vaultCreate = (name: string) => invoke<VaultList>("vault_create", { name });

export const vaultRename = (id: string, name: string) => invoke<VaultList>("vault_rename", { id, name });

export const vaultSwitch = (id: string) => invoke<VaultList>("vault_switch", { id });

export const tagList = (categoryId?: number) => invoke<TagCount[]>("tag_list", { categoryId });

export const noteSetTags = (noteId: number, names: string[]) =>
  invoke<string[]>("note_set_tags", { noteId, names });

/** Abre un enlace en el navegador del sistema; solo http, https y mailto. */
export async function openExternal(url: string): Promise<void> {
  if (/^(https?:|mailto:)/i.test(url)) await openUrl(url);
}
