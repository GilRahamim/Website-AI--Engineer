import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Favorite, Progress, ProgressStatus, Recent } from '../types';

interface KbUserDataSchema extends DBSchema {
  progress: { key: string; value: Progress };
  favorites: { key: string; value: Favorite };
  recents: { key: string; value: Recent };
}

const DB_NAME = 'kb-user-data';
const DB_VERSION = 1;
const RECENTS_LIMIT = 12;

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

export async function toggleFavorite(topicId: string): Promise<void> {
  try {
    const db = await getDb();
    const existing = await db.get('favorites', topicId);
    if (existing) {
      await db.delete('favorites', topicId);
    } else {
      await db.put('favorites', { topicId, createdAt: Date.now() });
    }
  } catch (error) {
    warnOnce('toggleFavorite', error);
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

/** Test-only: clears the memoized connection and the warn-once flag so each
 *  test starts from a clean slate. Not used by application code. */
export function __resetDbForTests(): void {
  dbPromise = null;
  warned = false;
}
