import { create } from 'zustand';
import type { ProgressStatus } from '../types';
import { NEXT_STATUS } from '../lib/progressStatus';
import {
  getAllFavorites,
  getAllProgress,
  getAllRecents,
  recordView as persistRecordView,
  setProgress as persistSetProgress,
  toggleFavorite as persistToggleFavorite,
} from '../lib/db';

interface RecentEntry {
  topicId: string;
  viewedAt: number;
}

interface UserDataState {
  progress: Map<string, ProgressStatus>;
  favorites: Set<string>;
  recents: RecentEntry[];
  isLoaded: boolean;

  loadUserData: () => Promise<void>;
  setStatus: (topicId: string, status: ProgressStatus) => void;
  cycleStatus: (topicId: string) => void;
  toggleFavorite: (topicId: string) => void;
  recordView: (topicId: string) => void;
}

const RECENTS_LIMIT = 12;

export const useUserDataStore = create<UserDataState>()((set, get) => ({
  progress: new Map(),
  favorites: new Set(),
  recents: [],
  isLoaded: false,

  loadUserData: async () => {
    try {
      const [progressRows, favoriteRows, recentRows] = await Promise.all([
        getAllProgress(),
        getAllFavorites(),
        getAllRecents(),
      ]);
      const favoritesNewestFirst = [...favoriteRows].sort((a, b) => b.createdAt - a.createdAt);
      set({
        progress: new Map(progressRows.map((row) => [row.topicId, row.status])),
        favorites: new Set(favoritesNewestFirst.map((row) => row.topicId)),
        recents: recentRows.map((row) => ({ topicId: row.topicId, viewedAt: row.viewedAt })),
        isLoaded: true,
      });
    } catch {
      // getAllProgress/getAllFavorites/getAllRecents already catch their own
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
    void persistToggleFavorite(topicId);
  },

  recordView: (topicId) => {
    set((state) => {
      const withoutTopic = state.recents.filter((r) => r.topicId !== topicId);
      return { recents: [{ topicId, viewedAt: Date.now() }, ...withoutTopic].slice(0, RECENTS_LIMIT) };
    });
    void persistRecordView(topicId);
  },
}));
