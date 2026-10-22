import { create } from "zustand";
import * as api from "../api";
import { debounce } from "../lib/debounce";
import { deriveTitle } from "../lib/text";
import { useUi } from "./ui";

export type CategoryFilter = number | "all";
export type SaveStatus = "saved" | "saving" | "error";
export type LoadStatus = "loading" | "ready" | "error";

const SAVE_DELAY = 600;
const RETRY_DELAY = 3000;
const QUERY_DELAY = 200;

interface NotesState {
  categories: api.Category[];
  categoryId: CategoryFilter;
  selectedTagIds: number[];
  query: string;

  list: api.NoteSummary[];
  listStatus: LoadStatus;
  listLoaded: boolean;
  listError: string | null;
  tags: api.TagCount[];
  tagsError: boolean;

  currentNote: api.Note | null;
  /** Texto y título actuales; CodeMirror es la fuente mientras se escribe y aquí se refleja. */
  body: string;
  title: string;
  dirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  noteError: string | null;

  /** Selección múltiple de la lista (2 o más). Vacía cuando hay una sola nota abierta. */
  multiIds: number[];
  anchorId: number | null;

  trashMode: boolean;
  trash: api.TrashNote[];
  trashSelectedId: number | null;
  trashStatus: LoadStatus;

  init: () => Promise<void>;
  setCategory: (id: CategoryFilter) => Promise<void>;
  toggleTag: (id: number) => void;
  clearTags: () => void;
  setQuery: (q: string) => void;
  refreshList: (opts?: { reselect?: boolean }) => Promise<void>;
  refreshTags: () => Promise<void>;
  selectNote: (id: number) => Promise<void>;
  clickNote: (id: number, mods: { ctrl: boolean; shift: boolean }) => void;
  clearMulti: () => void;
  selectAllVisible: () => void;
  trashMany: (ids: number[]) => Promise<void>;
  moveNotes: (ids: number[], categoryId: number | null) => Promise<void>;
  pinNotes: (ids: number[], pinned: boolean) => Promise<void>;
  createNote: () => Promise<void>;
  setBody: (body: string) => void;
  toggleTask: (line: number) => void;
  flush: () => Promise<boolean>;
  setPinned: (id: number, pinned: boolean) => Promise<void>;
  trashNote: (id: number) => Promise<void>;
  moveNote: (id: number, categoryId: number | null) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  openTrash: () => Promise<void>;
  refreshTrash: () => Promise<void>;
  selectTrash: (id: number | null) => void;
  restoreNote: (id: number) => Promise<void>;
  purgeNote: (id: number) => Promise<void>;
  emptyTrash: () => Promise<void>;
  reset: () => Promise<void>;
  setNoteTags: (names: string[]) => Promise<void>;
  createCategory: (input: { name: string; emoji: string; hue: number }) => Promise<void>;
  updateCategory: (id: number, patch: { emoji?: string; hue?: number }) => Promise<void>;
}

const fail = (e: unknown) => useUi.getState().showNotice(api.describeError(e));

export const useNotes = create<NotesState>((set, get) => {
  let listSeq = 0;
  let tagSeq = 0;
  let noteSeq = 0;
  let bodyVersion = 0;
  let saveTimer: number | undefined;
  let retryTimer: number | undefined;
  // Los guardados se encadenan para que nunca se pisen entre sí.
  let chain: Promise<unknown> = Promise.resolve();

  const activeCategory = () => {
    const id = get().categoryId;
    return id === "all" ? undefined : id;
  };

  const clearTimers = () => {
    window.clearTimeout(saveTimer);
    window.clearTimeout(retryTimer);
  };

  const scheduleSave = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void get().flush(), SAVE_DELAY);
  };

  const doSave = async (): Promise<boolean> => {
    const { currentNote, dirty, body, title } = get();
    if (!currentNote || !dirty) return true;
    const version = bodyVersion;
    set({ saveStatus: "saving", saveError: null });
    try {
      const updatedAt = await api.noteUpdate(currentNote.id, title, body);
      const now = get();
      if (now.currentNote?.id === currentNote.id) {
        const stale = bodyVersion !== version;
        set({
          currentNote: { ...now.currentNote, title, updatedAt },
          dirty: stale,
          saveStatus: stale ? "saving" : "saved",
        });
        if (stale) scheduleSave();
      }
      void get().refreshList();
      return true;
    } catch (e) {
      // El texto sigue en memoria: se avisa y se reintenta.
      set({ saveStatus: "error", saveError: api.describeError(e) });
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => void get().flush(), RETRY_DELAY);
      return false;
    }
  };

  const reselect = async (list: api.NoteSummary[]) => {
    const cur = get().currentNote;
    if (cur && list.some((n) => n.id === cur.id)) return;
    if (list.length > 0) {
      await get().selectNote(list[0].id);
    } else if (await get().flush()) {
      noteSeq++;
      set({ currentNote: null, body: "", title: "", dirty: false, noteError: null, saveStatus: "saved" });
    }
  };

  const debouncedQuery = debounce(() => void get().refreshList({ reselect: true }), QUERY_DELAY);

  return {
    categories: [],
    categoryId: "all",
    selectedTagIds: [],
    query: "",
    list: [],
    listStatus: "loading",
    listLoaded: false,
    listError: null,
    tags: [],
    tagsError: false,
    currentNote: null,
    body: "",
    title: "",
    dirty: false,
    saveStatus: "saved",
    saveError: null,
    noteError: null,
    multiIds: [],
    anchorId: null,
    trashMode: false,
    trash: [],
    trashSelectedId: null,
    trashStatus: "ready",

    init: async () => {
      set({ listStatus: "loading", listError: null });
      try {
        const categories = await api.categoryList();
        set({ categories });
      } catch (e) {
        set({ listStatus: "error", listError: api.describeError(e) });
        return;
      }
      await Promise.all([get().refreshTags(), get().refreshList({ reselect: true }), get().refreshTrash()]);
    },

    setCategory: async (id) => {
      if (get().categoryId === id && !get().trashMode) return;
      useUi.getState().closePopover();
      // Elegir una categoría (o "Todas") también sale de la papelera.
      set({ categoryId: id, selectedTagIds: [], trashMode: false, trashSelectedId: null, multiIds: [] });
      await Promise.all([get().refreshTags(), get().refreshList({ reselect: true })]);
    },

    toggleTag: (id) => {
      const sel = get().selectedTagIds;
      set({ selectedTagIds: sel.includes(id) ? sel.filter((t) => t !== id) : [...sel, id], multiIds: [] });
      void get().refreshList({ reselect: true });
    },

    clearTags: () => {
      set({ selectedTagIds: [], multiIds: [] });
      void get().refreshList({ reselect: true });
    },

    setQuery: (q) => {
      set({ query: q, multiIds: [] });
      debouncedQuery();
    },

    refreshList: async ({ reselect: doReselect = false } = {}) => {
      const seq = ++listSeq;
      const s = get();
      // Con una lista ya cargada no se vacía mientras llega la nueva: evita parpadeos.
      if (!s.listLoaded) set({ listStatus: "loading" });
      try {
        const list = await api.noteList({
          categoryId: activeCategory(),
          tagIds: s.selectedTagIds.length > 0 ? s.selectedTagIds : undefined,
          query: s.query.trim() || undefined,
        });
        if (seq !== listSeq) return;
        const present = new Set(list.map((n) => n.id));
        const multi = get().multiIds.filter((id) => present.has(id));
        set({
          list,
          listStatus: "ready",
          listLoaded: true,
          listError: null,
          multiIds: multi.length >= 2 ? multi : [],
        });
        if (doReselect) await reselect(list);
      } catch (e) {
        if (seq !== listSeq) return;
        set({ listStatus: "error", listError: api.describeError(e) });
      }
    },

    refreshTags: async () => {
      const seq = ++tagSeq;
      try {
        const tags = await api.tagList(activeCategory());
        if (seq !== tagSeq) return;
        const known = new Set(tags.map((t) => t.id));
        const prev = get().selectedTagIds;
        const selectedTagIds = prev.filter((id) => known.has(id));
        set({ tags, tagsError: false, selectedTagIds });
        if (selectedTagIds.length !== prev.length) void get().refreshList({ reselect: true });
      } catch {
        if (seq === tagSeq) set({ tagsError: true });
      }
    },

    selectNote: async (id) => {
      if (get().currentNote?.id === id) return;
      // Si el guardado falla no se cambia de nota, para no perder el texto.
      if (!(await get().flush())) return;
      const token = ++noteSeq;
      try {
        const note = await api.noteGet(id);
        if (token !== noteSeq) return;
        bodyVersion++;
        set({
          currentNote: note,
          body: note.body,
          title: note.title,
          dirty: false,
          saveStatus: "saved",
          saveError: null,
          noteError: null,
        });
      } catch (e) {
        if (token === noteSeq) set({ noteError: api.describeError(e) });
      }
    },

    createNote: async () => {
      if (!(await get().flush())) return;
      try {
        const note = await api.noteCreate(activeCategory());
        noteSeq++;
        bodyVersion++;
        const ui = useUi.getState();
        if (ui.mode === "view") ui.setMode("split");
        ui.requestEditorFocus();
        // Se limpian búsqueda y etiquetas para que la nota nueva aparezca en la lista.
        debouncedQuery.cancel();
        set({
          currentNote: note,
          body: note.body,
          title: note.title,
          dirty: false,
          saveStatus: "saved",
          saveError: null,
          noteError: null,
          query: "",
          selectedTagIds: [],
          multiIds: [],
        });
        await Promise.all([get().refreshList(), get().refreshTags()]);
      } catch (e) {
        fail(e);
      }
    },

    setBody: (body) => {
      if (!get().currentNote || body === get().body) return;
      bodyVersion++;
      set({ body, title: deriveTitle(body), dirty: true, saveStatus: "saving", saveError: null });
      scheduleSave();
    },

    toggleTask: (line) => {
      const lines = get().body.split("\n");
      const text = lines[line - 1];
      if (text === undefined) return;
      const next = text.replace(/\[([ xX])\]/, (_m, c: string) => (c === " " ? "[x]" : "[ ]"));
      if (next === text) return;
      lines[line - 1] = next;
      get().setBody(lines.join("\n"));
    },

    flush: () => {
      clearTimers();
      const p = chain.then(doSave);
      chain = p;
      return p;
    },

    setPinned: async (id, pinned) => {
      try {
        await api.notePin(id, pinned);
        const cur = get().currentNote;
        if (cur?.id === id) set({ currentNote: { ...cur, pinned } });
        await get().refreshList();
      } catch (e) {
        fail(e);
      }
    },

    trashNote: async (id) => {
      const isCurrent = get().currentNote?.id === id;
      if (isCurrent) {
        clearTimers();
        await chain;
      }
      try {
        await api.noteTrash(id);
      } catch (e) {
        fail(e);
        if (isCurrent && get().dirty) scheduleSave();
        return;
      }
      if (!isCurrent) {
        await Promise.all([get().refreshList(), get().refreshTags(), get().refreshTrash()]);
        return;
      }
      // El texto pendiente de una nota enviada a la papelera ya no se guarda.
      bodyVersion++;
      set({ dirty: false });
      const index = get().list.findIndex((n) => n.id === id);
      await Promise.all([get().refreshList(), get().refreshTags(), get().refreshTrash()]);
      const list = get().list;
      const next = list[Math.min(Math.max(index, 0), list.length - 1)];
      if (next) {
        await get().selectNote(next.id);
      } else {
        noteSeq++;
        set({ currentNote: null, body: "", title: "", saveStatus: "saved" });
      }
    },

    clickNote: (id, mods) => {
      const s = get();
      if (mods.shift) {
        const ids = s.list.map((n) => n.id);
        const a = ids.indexOf(s.anchorId ?? s.currentNote?.id ?? id);
        const b = ids.indexOf(id);
        if (a >= 0 && b >= 0 && a !== b) {
          set({ multiIds: ids.slice(Math.min(a, b), Math.max(a, b) + 1) });
          return;
        }
      } else if (mods.ctrl) {
        const base = s.multiIds.length > 0 ? s.multiIds : s.currentNote ? [s.currentNote.id] : [];
        const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
        const order = s.list.map((n) => n.id);
        next.sort((x, y) => order.indexOf(x) - order.indexOf(y));
        set({ anchorId: id, multiIds: next.length >= 2 ? next : [] });
        if (next.length === 1) void get().selectNote(next[0]);
        return;
      }
      set({ multiIds: [], anchorId: id });
      void get().selectNote(id);
    },

    clearMulti: () => set({ multiIds: [] }),

    selectAllVisible: () => {
      const ids = get().list.map((n) => n.id);
      if (ids.length >= 2) set({ multiIds: ids });
    },

    trashMany: async (ids) => {
      const s = get();
      const affectsCurrent = s.currentNote !== null && ids.includes(s.currentNote.id);
      if (affectsCurrent) {
        clearTimers();
        await chain;
      }
      try {
        await api.noteTrashMany(ids);
      } catch (e) {
        fail(e);
        if (affectsCurrent && get().dirty) scheduleSave();
        return;
      }
      if (affectsCurrent) {
        bodyVersion++;
        set({ dirty: false });
      }
      const order = s.list.map((n) => n.id);
      const first = Math.min(...ids.map((id) => order.indexOf(id)).filter((i) => i >= 0));
      set({ multiIds: [] });
      await Promise.all([get().refreshList(), get().refreshTags(), get().refreshTrash()]);
      if (!affectsCurrent && get().currentNote) return;
      // Tras borrar, queda la nota más cercana a la primera borrada.
      const list = get().list;
      const next = list[Math.min(Math.max(first, 0), list.length - 1)];
      if (next) {
        await get().selectNote(next.id);
      } else {
        noteSeq++;
        set({ currentNote: null, body: "", title: "", saveStatus: "saved" });
      }
    },

    moveNotes: async (ids, categoryId) => {
      try {
        await Promise.all(ids.map((id) => api.noteMove(id, categoryId)));
        const cur = get().currentNote;
        if (cur && ids.includes(cur.id)) set({ currentNote: { ...cur, categoryId } });
        await Promise.all([get().refreshList(), get().refreshTags()]);
      } catch (e) {
        fail(e);
      }
    },

    pinNotes: async (ids, pinned) => {
      try {
        await Promise.all(ids.map((id) => api.notePin(id, pinned)));
        const cur = get().currentNote;
        if (cur && ids.includes(cur.id)) set({ currentNote: { ...cur, pinned } });
        await get().refreshList();
      } catch (e) {
        fail(e);
      }
    },

    moveNote: async (id, categoryId) => {
      try {
        await api.noteMove(id, categoryId);
        const cur = get().currentNote;
        if (cur?.id === id) set({ currentNote: { ...cur, categoryId } });
        await Promise.all([get().refreshList(), get().refreshTags()]);
      } catch (e) {
        fail(e);
      }
    },

    deleteCategory: async (id) => {
      try {
        await api.categoryDelete(id);
      } catch (e) {
        fail(e);
        return;
      }
      set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
      const cur = get().currentNote;
      if (cur?.categoryId === id) set({ currentNote: { ...cur, categoryId: null } });
      if (get().categoryId === id) {
        await get().setCategory("all");
      } else {
        await Promise.all([get().refreshList(), get().refreshTags(), get().refreshTrash()]);
      }
    },

    openTrash: async () => {
      if (!(await get().flush())) return;
      useUi.getState().closePopover();
      noteSeq++;
      bodyVersion++;
      set({
        trashMode: true,
        currentNote: null,
        body: "",
        title: "",
        dirty: false,
        saveStatus: "saved",
        saveError: null,
        noteError: null,
        multiIds: [],
      });
      await get().refreshTrash();
      if (get().trashSelectedId === null) set({ trashSelectedId: get().trash[0]?.id ?? null });
    },

    refreshTrash: async () => {
      if (get().trashMode && get().trash.length === 0) set({ trashStatus: "loading" });
      try {
        const trash = await api.trashList();
        const sel = get().trashSelectedId;
        set({
          trash,
          trashStatus: "ready",
          trashSelectedId: trash.some((n) => n.id === sel) ? sel : (trash[0]?.id ?? null),
        });
      } catch (e) {
        set({ trashStatus: "error" });
        if (get().trashMode) fail(e);
      }
    },

    selectTrash: (id) => set({ trashSelectedId: id }),

    restoreNote: async (id) => {
      try {
        await api.noteRestore(id);
      } catch (e) {
        fail(e);
        return;
      }
      await get().refreshTrash();
    },

    purgeNote: async (id) => {
      try {
        await api.notePurge(id);
      } catch (e) {
        fail(e);
        return;
      }
      await get().refreshTrash();
    },

    emptyTrash: async () => {
      try {
        await api.trashEmpty();
      } catch (e) {
        fail(e);
        return;
      }
      await get().refreshTrash();
    },

    reset: async () => {
      clearTimers();
      debouncedQuery.cancel();
      listSeq++;
      tagSeq++;
      noteSeq++;
      bodyVersion++;
      chain = Promise.resolve();
      useUi.getState().closePopover();
      set({
        categories: [],
        categoryId: "all",
        selectedTagIds: [],
        query: "",
        list: [],
        listStatus: "loading",
        listLoaded: false,
        listError: null,
        tags: [],
        tagsError: false,
        currentNote: null,
        body: "",
        title: "",
        dirty: false,
        saveStatus: "saved",
        saveError: null,
        noteError: null,
        multiIds: [],
        anchorId: null,
        trashMode: false,
        trash: [],
        trashSelectedId: null,
        trashStatus: "ready",
      });
      await get().init();
    },

    setNoteTags: async (names) => {
      const note = get().currentNote;
      if (!note) return;
      try {
        const tags = await api.noteSetTags(note.id, names);
        const cur = get().currentNote;
        if (cur?.id === note.id) set({ currentNote: { ...cur, tags } });
        await Promise.all([get().refreshTags(), get().refreshList()]);
      } catch (e) {
        fail(e);
      }
    },

    createCategory: async (input) => {
      // Los errores suben al popover, que muestra el mensaje junto al formulario.
      const category = await api.categoryCreate(input);
      set((s) => ({ categories: [...s.categories, category] }));
      await get().setCategory(category.id);
    },

    updateCategory: async (id, patch) => {
      try {
        const updated = await api.categoryUpdate({ id, ...patch });
        set((s) => ({ categories: s.categories.map((c) => (c.id === id ? updated : c)) }));
      } catch (e) {
        fail(e);
      }
    },
  };
});
