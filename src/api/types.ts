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
}

export interface VaultList {
  vaults: VaultSummary[];
  activeId: string | null;
}

export interface ListParams {
  categoryId?: number;
  tagIds?: number[];
  query?: string;
  limit?: number;
  offset?: number;
}

export type ApiErrorCode = "Locked" | "NotFound" | "Invalid" | "Db";

export interface ApiError {
  code: ApiErrorCode;
  message?: string;
}
