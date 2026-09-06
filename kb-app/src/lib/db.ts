import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Favorite, Note, Progress, ProgressStatus, Recent } from '../types';

interface KbUserDataSchema extends DBSchema {
  progress: { key: string; value: Progress };
  favorites: { key: string; value: Favorite };
  recents: { key: string; value: Recent };
  notes: { key: string; value: Note };
}

const DB_NAME = 'kb-user-data';
const DB_VERSION = 2;
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

/** Test-only: clears the memoized connection and the warn-once flag so each
 *  test starts from a clean slate. Not used by application code. */
export function __resetDbForTests(): void {
  dbPromise = null;
  warned = false;
}
