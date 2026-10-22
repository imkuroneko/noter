export interface Category {
  id: number;
  name: string;
  emoji: string;
  hue: number;
  position: number;
}

export interface NoteSummary {
  id: number;
  title: string;
  snippet: string;
  titleHl: string | null;
  categoryId: number | null;
  pinned: boolean;
  updatedAt: number;
  tags: string[];
}

export interface Note {
  id: number;
  title: string;
  body: string;
  categoryId: number | null;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export interface TagCount {
  id: number;
  name: string;
  count: number;
}

export interface TrashNote {
  id: number;
  title: string;
  snippet: string;
  categoryId: number | null;
  deletedAt: number;
}

export interface VaultSummary {
  id: string;
  name: string;
  /** Protegida con contraseña (base cifrada). */
  encrypted: boolean;
  /** Ruta completa del archivo .db. */
  path: string;
  /** El archivo existe donde la lista dice que está. */
  available: boolean;
  /** Está fuera de la carpeta de datos de la app. */
  custom: boolean;
}

export interface VaultStatus {
  vaults: VaultSummary[];
  activeId: string | null;
  locked: boolean;
  /** Hay una bóveda abierta y lista. Sin bloqueo y con esto en false, la activa no se pudo abrir. */
  open: boolean;
  /** Minutos de inactividad antes de bloquear; 0 = nunca. */
  idleMinutes: number;
  /** Copias sin cifrar que dejó "Proteger" (nombres de archivo en la carpeta backups). */
  backups: string[];
}

export interface VaultCreated {
  status: VaultStatus;
  recoveryKey: string | null;
}

export interface VaultProtected {
  status: VaultStatus;
  recoveryKey: string;
  backupFile: string;
}

export interface ImportInfo {
  name: string;
  encrypted: boolean;
}

export interface ImportCategory {
  id: number;
  name: string;
  emoji: string;
  hue: number;
  noteCount: number;
}

export interface ImportNote {
  id: number;
  title: string;
  snippet: string;
  categoryId: number | null;
  pinned: boolean;
  updatedAt: number;
  tags: string[];
}

export interface ImportPreview {
  name: string;
  categories: ImportCategory[];
  notes: ImportNote[];
  totalNotes: number;
  uncategorized: number;
}

export interface ImportOptions {
  noteIds: number[];
  keepCategories: boolean;
  targetCategoryId: number | null;
  skipDuplicates: boolean;
}

export interface ImportResult {
  imported: number;
  skippedDuplicates: number;
  createdCategories: number;
  createdTags: number;
}

export interface ListParams {
  categoryId?: number;
  tagIds?: number[];
  query?: string;
  limit?: number;
  offset?: number;
}

export type ApiErrorCode = "Locked" | "NotFound" | "Invalid" | "Db" | "BadPassword" | "Throttled";

export interface ApiError {
  code: ApiErrorCode;
  /** Texto, o segundos de espera cuando el código es Throttled. */
  message?: string | number;
}
