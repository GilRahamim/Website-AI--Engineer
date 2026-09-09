import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Favorite, Note, Progress, ProgressStatus, Recent, SrsCard } from '../types';

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  data: {
    progress: Progress[];
    favorites: Favorite[];
    recents: Recent[];
    notes: Note[];
    srsCards: SrsCard[];
  };
}

export type SyncTableName = 'progress' | 'notes' | 'favorites' | 'srsCards';

export interface SyncManifest {
  id: 'manifest';
  tables: Record<SyncTableName, string[]>;
  syncedAt: number;
}

interface KbUserDataSchema extends DBSchema {
  progress: { key: string; value: Progress };
  favorites: { key: string; value: Favorite };
  recents: { key: string; value: Recent };
  notes: { key: string; value: Note };
  srsCards: { key: string; value: SrsCard };
  syncMeta: { key: string; value: SyncManifest };
}

const DB_NAME = 'kb-user-data';
const DB_VERSION = 4;
export const RECENTS_LIMIT = 12;

let warned = false;
function warnOnce(context: string, error: unknown): void {
  if (warned) return;
  warned = true;
  console.warn(`[db] IndexedDB unavailable, continuing in-memory only (${context}):`, error);
}

let dbPromise: Promise<IDBPDatabase<KbUserDataSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<KbUserDataSchema>> {
  if (!dbPromise) {
    // Structured so a future version bump (Phase 3's notes/SRS sub-projects,
    // or Phase 5's sync metadata) only ever needs a new `if` branch here —
    // never a rewrite of the stores created by earlier versions.
    dbPromise = openDB<KbUserDataSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'topicId' });
        }
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'topicId' });
        }
        if (!db.objectStoreNames.contains('recents')) {
          db.createObjectStore('recents', { keyPath: 'topicId' });
        }
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'topicId' });
        }
        if (!db.objectStoreNames.contains('srsCards')) {
          db.createObjectStore('srsCards', { keyPath: 'topicId' });
        }
        if (!db.objectStoreNames.contains('syncMeta')) {
          db.createObjectStore('syncMeta', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllProgress(): Promise<Progress[]> {
  try {
    const db = await getDb();
    return await db.getAll('progress');
  } catch (error) {
    warnOnce('getAllProgress', error);
    return [];
  }
}

export async function setProgress(topicId: string, status: ProgressStatus): Promise<void> {
  try {
    const db = await getDb();
    await db.put('progress', { topicId, status, updatedAt: Date.now() });
  } catch (error) {
    warnOnce('setProgress', error);
  }
}

export async function getAllFavorites(): Promise<Favorite[]> {
  try {
    const db = await getDb();
    return await db.getAll('favorites');
  } catch (error) {
    warnOnce('getAllFavorites', error);
    return [];
  }
}

/** Idempotent — the caller (the Zustand store) already knows the desired end
 *  state from its own optimistic update, so this needs no read-then-write:
 *  a single `put`/`delete` can't interleave with itself the way a prior
 *  get-then-put/delete pair could across two rapid, un-awaited calls. */
export async function setFavorite(topicId: string, isFavorite: boolean): Promise<void> {
  try {
    const db = await getDb();
    if (isFavorite) {
      await db.put('favorites', { topicId, createdAt: Date.now() });
    } else {
      await db.delete('favorites', topicId);
    }
  } catch (error) {
    warnOnce('setFavorite', error);
  }
}

export async function getAllRecents(): Promise<Recent[]> {
  try {
    const db = await getDb();
    const all = await db.getAll('recents');
    return all.sort((a, b) => b.viewedAt - a.viewedAt).slice(0, RECENTS_LIMIT);
  } catch (error) {
    warnOnce('getAllRecents', error);
    return [];
  }
}

export async function recordView(topicId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.put('recents', { topicId, viewedAt: Date.now() });
  } catch (error) {
    warnOnce('recordView', error);
  }
}

export async function getAllNotes(): Promise<Note[]> {
  try {
    const db = await getDb();
    return await db.getAll('notes');
  } catch (error) {
    warnOnce('getAllNotes', error);
    return [];
  }
}

/** Idempotent, same shape as setFavorite: the caller already knows the final
 *  text, so a single put/delete needs no read-then-write. Empty or
 *  whitespace-only text deletes the row — absence of a record means "no
 *  note," matching progress/favorites' existing convention. */
export async function setNote(topicId: string, text: string): Promise<void> {
  try {
    const db = await getDb();
    if (text.trim() === '') {
      await db.delete('notes', topicId);
    } else {
      await db.put('notes', { topicId, text, updatedAt: Date.now() });
    }
  } catch (error) {
    warnOnce('setNote', error);
  }
}

export async function getAllSrsCards(): Promise<SrsCard[]> {
  try {
    const db = await getDb();
    return await db.getAll('srsCards');
  } catch (error) {
    warnOnce('getAllSrsCards', error);
    return [];
  }
}

/** Takes the fully-computed card (the caller already ran it through
 *  lib/srs.ts's gradeCard) — a single put, no read, same idempotent shape
 *  as setFavorite/setNote. */
export async function setSrsCard(card: SrsCard): Promise<void> {
  try {
    const db = await getDb();
    await db.put('srsCards', card);
  } catch (error) {
    warnOnce('setSrsCard', error);
  }
}

export async function exportAllData(): Promise<ExportPayload> {
  const [progress, favorites, recents, notes, srsCards] = await Promise.all([
    getAllProgress(),
    getAllFavorites(),
    getAllRecents(),
    getAllNotes(),
    getAllSrsCards(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { progress, favorites, recents, notes, srsCards },
  };
}

/** One readwrite transaction across all five stores: every store is cleared
 *  first, then every imported row is put — clear() and put() calls on the
 *  same store are issued synchronously in that order below, so IndexedDB's
 *  same-store FIFO request ordering guarantees clear-before-write even
 *  though nothing here is individually awaited until the final Promise.all.
 *  A single transaction means a mid-import failure can't leave some stores
 *  overwritten and others stale. */
export async function importAllData(data: ExportPayload['data']): Promise<boolean> {
  try {
    const db = await getDb();
    const tx = db.transaction(['progress', 'favorites', 'recents', 'notes', 'srsCards'], 'readwrite');
    await Promise.all([
      tx.objectStore('progress').clear(),
      tx.objectStore('favorites').clear(),
      tx.objectStore('recents').clear(),
      tx.objectStore('notes').clear(),
      tx.objectStore('srsCards').clear(),
      ...data.progress.map((row) => tx.objectStore('progress').put(row)),
      ...data.favorites.map((row) => tx.objectStore('favorites').put(row)),
      ...data.recents.map((row) => tx.objectStore('recents').put(row)),
      ...data.notes.map((row) => tx.objectStore('notes').put(row)),
      ...data.srsCards.map((row) => tx.objectStore('srsCards').put(row)),
      tx.done,
    ]);
    return true;
  } catch (error) {
    warnOnce('importAllData', error);
    return false;
  }
}

/** Writes rows exactly as given — including their own `updatedAt`/`createdAt`
 *  timestamps — unlike the UI-facing setters (setProgress, setFavorite, etc.)
 *  which always stamp `Date.now()`. Used only by the sync engine when
 *  applying a pulled remote row, which must keep its true remote timestamp
 *  so future last-write-wins comparisons stay correct. */
export async function putRows(
  table: SyncTableName,
  rows: (Progress | Note | Favorite | SrsCard)[],
): Promise<boolean> {
  try {
    const db = await getDb();
    const tx = db.transaction(table, 'readwrite');
    await Promise.all([...rows.map((row) => tx.objectStore(table).put(row as never)), tx.done]);
    return true;
  } catch (error) {
    warnOnce(`putRows:${table}`, error);
    return false;
  }
}

/** Used only by the sync engine to apply a remote deletion locally. */
export async function deleteRows(table: SyncTableName, topicIds: string[]): Promise<boolean> {
  try {
    const db = await getDb();
    const tx = db.transaction(table, 'readwrite');
    await Promise.all([...topicIds.map((id) => tx.objectStore(table).delete(id)), tx.done]);
    return true;
  } catch (error) {
    warnOnce(`deleteRows:${table}`, error);
    return false;
  }
}

export async function getSyncManifest(): Promise<SyncManifest | null> {
  try {
    const db = await getDb();
    const record = await db.get('syncMeta', 'manifest');
    return record ?? null;
  } catch (error) {
    warnOnce('getSyncManifest', error);
    return null;
  }
}

export async function setSyncManifest(manifest: SyncManifest): Promise<void> {
  try {
    const db = await getDb();
    await db.put('syncMeta', manifest);
  } catch (error) {
    warnOnce('setSyncManifest', error);
  }
}

/** Test-only: clears the memoized connection and the warn-once flag so each
 *  test starts from a clean slate. Not used by application code. */
export function __resetDbForTests(): void {
  dbPromise = null;
  warned = false;
}
