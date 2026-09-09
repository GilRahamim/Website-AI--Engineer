import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import {
  deleteRows,
  getAllFavorites,
  getAllNotes,
  getAllProgress,
  getAllSrsCards,
  getSyncManifest,
  putRows,
  setSyncManifest,
  type SyncManifest,
  type SyncTableName,
} from './db';
import type { Favorite, Note, Progress, SrsCard } from '../types';

type LocalRow = Progress | Note | Favorite | SrsCard;
type RemoteRow = Record<string, unknown>;
type Direction = 'push' | 'pull' | 'full';

const TABLES: SyncTableName[] = ['progress', 'notes', 'favorites', 'srsCards'];

const REMOTE_TABLE: Record<SyncTableName, string> = {
  progress: 'progress',
  notes: 'notes',
  favorites: 'favorites',
  srsCards: 'srs_cards',
};

// Timestamp column used both for LWW conflict comparison and pullSince's
// server-side filter. `favorites` has no updated_at locally or remotely
// (matching kb-app/supabase/schema.sql) — created_at stands in for it.
const TIMESTAMP_COLUMN: Record<SyncTableName, string> = {
  progress: 'updated_at',
  notes: 'updated_at',
  favorites: 'created_at',
  srsCards: 'updated_at',
};

function localTimestamp(table: SyncTableName, row: LocalRow): number {
  return table === 'favorites' ? (row as Favorite).createdAt : (row as Progress | Note | SrsCard).updatedAt;
}

function remoteTimestamp(table: SyncTableName, row: RemoteRow): number {
  return new Date(row[TIMESTAMP_COLUMN[table]] as string).getTime();
}

function toRemoteRow(table: SyncTableName, row: LocalRow, userId: string): RemoteRow {
  const base = { user_id: userId, topic_id: row.topicId };
  switch (table) {
    case 'progress': {
      const r = row as Progress;
      return { ...base, status: r.status, updated_at: new Date(r.updatedAt).toISOString() };
    }
    case 'notes': {
      const r = row as Note;
      return { ...base, text: r.text, updated_at: new Date(r.updatedAt).toISOString() };
    }
    case 'favorites': {
      const r = row as Favorite;
      return { ...base, created_at: new Date(r.createdAt).toISOString() };
    }
    case 'srsCards': {
      const r = row as SrsCard;
      return {
        ...base,
        ease: r.ease,
        interval_days: r.intervalDays,
        due_at: new Date(r.dueAt).toISOString(),
        reps: r.reps,
        lapses: r.lapses,
        updated_at: new Date(r.updatedAt).toISOString(),
      };
    }
  }
}

function fromRemoteRow(table: SyncTableName, row: RemoteRow): LocalRow {
  const topicId = row.topic_id as string;
  switch (table) {
    case 'progress':
      return { topicId, status: row.status as Progress['status'], updatedAt: new Date(row.updated_at as string).getTime() };
    case 'notes':
      return { topicId, text: row.text as string, updatedAt: new Date(row.updated_at as string).getTime() };
    case 'favorites':
      return { topicId, createdAt: new Date(row.created_at as string).getTime() };
    case 'srsCards':
      return {
        topicId,
        ease: row.ease as number,
        intervalDays: row.interval_days as number,
        dueAt: new Date(row.due_at as string).getTime(),
        reps: row.reps as number,
        lapses: row.lapses as number,
        updatedAt: new Date(row.updated_at as string).getTime(),
      };
  }
}

async function getLocalRows(table: SyncTableName): Promise<LocalRow[]> {
  switch (table) {
    case 'progress':
      return getAllProgress();
    case 'notes':
      return getAllNotes();
    case 'favorites':
      return getAllFavorites();
    case 'srsCards':
      return getAllSrsCards();
  }
}

/** Reconciles one table in one direction, using `manifestIds` (the ids known
 *  to exist on both sides as of the last successful fullSync) to tell a
 *  brand-new row apart from a deletion. Returns the resulting set of ids
 *  this table should hold on BOTH sides once `direction === 'full'` has
 *  applied every branch — callers reconciling only one direction (push or
 *  pull) may ignore the return value, since it isn't a complete picture of
 *  the other, un-applied side.
 *
 *  Deletion classification (see spec Section 2 for the full reasoning):
 *  present locally + absent remotely + id in manifest -> remote lost it
 *  since last sync -> delete locally. Present remotely + absent locally +
 *  id in manifest -> this device deleted it since last sync -> delete
 *  remotely. Either side present + id NOT in manifest -> brand new, never
 *  synced before -> push or pull, never delete. */
async function reconcileTable(
  supabase: SupabaseClient,
  userId: string,
  table: SyncTableName,
  direction: Direction,
  manifestIds: Set<string>,
  sinceTs?: number,
): Promise<Set<string>> {
  const localRows = await getLocalRows(table);

  let query = supabase.from(REMOTE_TABLE[table]).select('*');
  if (sinceTs !== undefined) {
    query = query.gt(TIMESTAMP_COLUMN[table], new Date(sinceTs).toISOString());
  }
  const { data } = await query;
  const remoteRows = (data ?? []) as RemoteRow[];

  const localById = new Map(localRows.map((r) => [r.topicId, r]));
  const remoteById = new Map(remoteRows.map((r) => [r.topic_id as string, r]));

  const toPush: LocalRow[] = [];
  const toPull: RemoteRow[] = [];
  const remoteDeleteIds: string[] = [];
  const localDeleteIds: string[] = [];

  const allIds = new Set([...localById.keys(), ...remoteById.keys()]);
  for (const id of allIds) {
    const local = localById.get(id);
    const remote = remoteById.get(id);
    if (local && remote) {
      if (localTimestamp(table, local) > remoteTimestamp(table, remote)) toPush.push(local);
      else toPull.push(remote);
    } else if (local && !remote) {
      if (manifestIds.has(id)) localDeleteIds.push(id);
      else toPush.push(local);
    } else if (!local && remote) {
      if (manifestIds.has(id)) remoteDeleteIds.push(id);
      else toPull.push(remote);
    }
  }

  if (direction === 'push' || direction === 'full') {
    if (toPush.length > 0) {
      await supabase.from(REMOTE_TABLE[table]).upsert(toPush.map((r) => toRemoteRow(table, r, userId)));
    }
    if (remoteDeleteIds.length > 0) {
      await supabase.from(REMOTE_TABLE[table]).delete().in('topic_id', remoteDeleteIds);
    }
  }
  if (direction === 'pull' || direction === 'full') {
    if (toPull.length > 0) {
      await putRows(table, toPull.map((r) => fromRemoteRow(table, r)));
    }
    if (localDeleteIds.length > 0) {
      await deleteRows(table, localDeleteIds);
    }
  }

  const finalIds = new Set(allIds);
  for (const id of remoteDeleteIds) finalIds.delete(id);
  for (const id of localDeleteIds) finalIds.delete(id);
  return finalIds;
}

async function currentUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fullSync(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const userId = await currentUserId(supabase);
  if (!userId) return;

  const manifest: SyncManifest | null = await getSyncManifest();
  const newTables = { progress: [], notes: [], favorites: [], srsCards: [] } as Record<SyncTableName, string[]>;

  for (const table of TABLES) {
    const manifestIds = new Set(manifest?.tables[table] ?? []);
    try {
      const finalIds = await reconcileTable(supabase, userId, table, 'full', manifestIds);
      newTables[table] = [...finalIds];
    } catch (error) {
      console.warn(`[sync] fullSync failed for ${table}:`, error);
      newTables[table] = [...manifestIds];
    }
  }

  await setSyncManifest({ id: 'manifest', tables: newTables, syncedAt: Date.now() });
}

export async function pushDirty(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const userId = await currentUserId(supabase);
  if (!userId) return;

  const manifest = await getSyncManifest();
  for (const table of TABLES) {
    try {
      await reconcileTable(supabase, userId, table, 'push', new Set(manifest?.tables[table] ?? []));
    } catch (error) {
      console.warn(`[sync] pushDirty failed for ${table}:`, error);
    }
  }
}

export async function pullSince(ts: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const userId = await currentUserId(supabase);
  if (!userId) return;

  const manifest = await getSyncManifest();
  for (const table of TABLES) {
    try {
      await reconcileTable(supabase, userId, table, 'pull', new Set(manifest?.tables[table] ?? []), ts);
    } catch (error) {
      console.warn(`[sync] pullSince failed for ${table}:`, error);
    }
  }
}
