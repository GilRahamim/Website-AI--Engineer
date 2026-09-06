import { create } from 'zustand';
import type { ProgressStatus } from '../types';
import { NEXT_STATUS } from '../lib/progressStatus';
import {
  getAllFavorites,
  getAllNotes,
  getAllProgress,
  getAllRecents,
  RECENTS_LIMIT,
  recordView as persistRecordView,
  setFavorite as persistSetFavorite,
  setNote as persistSetNote,
  setProgress as persistSetProgress,
} from '../lib/db';

interface RecentEntry {
  topicId: string;
  viewedAt: number;
}

interface UserDataState {
  progress: Map<string, ProgressStatus>;
  favorites: Set<string>;
  recents: RecentEntry[];
  notes: Map<string, string>;
  isLoaded: boolean;

  loadUserData: () => Promise<void>;
  setStatus: (topicId: string, status: ProgressStatus) => void;
  cycleStatus: (topicId: string) => void;
  toggleFavorite: (topicId: string) => void;
  recordView: (topicId: string) => void;
  setNote: (topicId: string, text: string) => void;
}

export const useUserDataStore = create<UserDataState>()((set, get) => ({
  progress: new Map(),
  favorites: new Set(),
  recents: [],
  notes: new Map(),
  isLoaded: false,

  loadUserData: async () => {
    try {
      const [progressRows, favoriteRows, recentRows, noteRows] = await Promise.all([
        getAllProgress(),
        getAllFavorites(),
        getAllRecents(),
        getAllNotes(),
      ]);
      const favoritesNewestFirst = [...favoriteRows].sort((a, b) => b.createdAt - a.createdAt);
      set({
        progress: new Map(progressRows.map((row) => [row.topicId, row.status])),
        favorites: new Set(favoritesNewestFirst.map((row) => row.topicId)),
        recents: recentRows.map((row) => ({ topicId: row.topicId, viewedAt: row.viewedAt })),
        notes: new Map(noteRows.map((row) => [row.topicId, row.text])),
        isLoaded: true,
      });
    } catch {
      // getAllProgress/getAllFavorites/getAllRecents/getAllNotes already catch their own
      // errors and resolve with safe defaults — this only guards Promise.all's
      // own plumbing, so isLoaded still settles true either way.
      set({ isLoaded: true });
    }
  },

  setStatus: (topicId, status) => {
    set((state) => {
      const next = new Map(state.progress);
      next.set(topicId, status);
      return { progress: next };
    });
    void persistSetProgress(topicId, status);
  },

  cycleStatus: (topicId) => {
    const current = get().progress.get(topicId) ?? 'new';
    get().setStatus(topicId, NEXT_STATUS[current]);
  },

  toggleFavorite: (topicId) => {
    const willBeFavorite = !get().favorites.has(topicId);
    set((state) => {
      if (state.favorites.has(topicId)) {
        const next = new Set(state.favorites);
        next.delete(topicId);
        return { favorites: next };
      }
      // Prepend rather than append: a Set iterates in insertion order, and we
      // want the newest favorite first, matching loadUserData's ordering.
      return { favorites: new Set([topicId, ...state.favorites]) };
    });
    // Store already knows the desired end state — pass it through so the
    // persistence call is idempotent and never needs its own read.
    void persistSetFavorite(topicId, willBeFavorite);
  },

  recordView: (topicId) => {
    set((state) => {
      const withoutTopic = state.recents.filter((r) => r.topicId !== topicId);
      return { recents: [{ topicId, viewedAt: Date.now() }, ...withoutTopic].slice(0, RECENTS_LIMIT) };
    });
    void persistRecordView(topicId);
  },

  setNote: (topicId, text) => {
    set((state) => {
      const next = new Map(state.notes);
      if (text.trim() === '') {
        next.delete(topicId);
      } else {
        next.set(topicId, text);
      }
      return { notes: next };
    });
    void persistSetNote(topicId, text);
  },
}));
