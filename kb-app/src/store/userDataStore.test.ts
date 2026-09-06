import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserDataStore } from './userDataStore';
import * as db from '../lib/db';

function resetStore() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    isLoaded: false,
  });
}

describe('userDataStore', () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  describe('cycleStatus', () => {
    it('cycles new -> learning -> mastered -> new (missing record defaults to new)', () => {
      const { cycleStatus } = useUserDataStore.getState();
      cycleStatus('topic-a');
      expect(useUserDataStore.getState().progress.get('topic-a')).toBe('learning');
      cycleStatus('topic-a');
      expect(useUserDataStore.getState().progress.get('topic-a')).toBe('mastered');
      cycleStatus('topic-a');
      expect(useUserDataStore.getState().progress.get('topic-a')).toBe('new');
    });

    it('updates state synchronously and persists via db.setProgress without the caller awaiting it', () => {
      const setProgressSpy = vi.spyOn(db, 'setProgress').mockResolvedValue(undefined);
      useUserDataStore.getState().cycleStatus('topic-a');
      expect(useUserDataStore.getState().progress.get('topic-a')).toBe('learning');
      expect(setProgressSpy).toHaveBeenCalledWith('topic-a', 'learning');
    });
  });

  describe('toggleFavorite', () => {
    it('adds then removes a favorite', () => {
      const { toggleFavorite } = useUserDataStore.getState();
      toggleFavorite('topic-a');
      expect(useUserDataStore.getState().favorites.has('topic-a')).toBe(true);
      toggleFavorite('topic-a');
      expect(useUserDataStore.getState().favorites.has('topic-a')).toBe(false);
    });

    it('the most recently favorited topic iterates first', () => {
      const { toggleFavorite } = useUserDataStore.getState();
      toggleFavorite('topic-a');
      toggleFavorite('topic-b');
      expect([...useUserDataStore.getState().favorites]).toEqual(['topic-b', 'topic-a']);
    });

    it('persists via db.setFavorite with the computed next state, without the caller awaiting it', () => {
      const setFavoriteSpy = vi.spyOn(db, 'setFavorite').mockResolvedValue(undefined);
      useUserDataStore.getState().toggleFavorite('topic-a');
      expect(setFavoriteSpy).toHaveBeenCalledWith('topic-a', true);

      useUserDataStore.getState().toggleFavorite('topic-a');
      expect(setFavoriteSpy).toHaveBeenCalledWith('topic-a', false);
    });
  });

  describe('recordView', () => {
    it('adds a recent entry, moving repeat views to the front without duplicating', () => {
      const { recordView } = useUserDataStore.getState();
      recordView('topic-a');
      recordView('topic-b');
      recordView('topic-a');
      expect(useUserDataStore.getState().recents.map((r) => r.topicId)).toEqual(['topic-a', 'topic-b']);
    });

    it('persists via db.recordView without the caller awaiting it', () => {
      const recordViewSpy = vi.spyOn(db, 'recordView').mockResolvedValue(undefined);
      useUserDataStore.getState().recordView('topic-a');
      expect(recordViewSpy).toHaveBeenCalledWith('topic-a');
    });
  });

  describe('setNote', () => {
    it('sets note text for a topic', () => {
      useUserDataStore.getState().setNote('topic-a', 'hello');
      expect(useUserDataStore.getState().notes.get('topic-a')).toBe('hello');
    });

    it('deletes the note when text is empty or whitespace-only', () => {
      useUserDataStore.getState().setNote('topic-a', 'hello');
      useUserDataStore.getState().setNote('topic-a', '   ');
      expect(useUserDataStore.getState().notes.has('topic-a')).toBe(false);
    });

    it('persists via db.setNote with the exact text, without the caller awaiting it', () => {
      const setNoteSpy = vi.spyOn(db, 'setNote').mockResolvedValue(undefined);
      useUserDataStore.getState().setNote('topic-a', 'hello');
      expect(setNoteSpy).toHaveBeenCalledWith('topic-a', 'hello');
    });
  });

  describe('loadUserData', () => {
    it('populates progress, favorites (newest-createdAt-first), recents and notes, and sets isLoaded', async () => {
      vi.spyOn(db, 'getAllProgress').mockResolvedValue([
        { topicId: 'topic-a', status: 'mastered', updatedAt: 1 },
      ]);
      vi.spyOn(db, 'getAllFavorites').mockResolvedValue([
        { topicId: 'topic-b', createdAt: 1 },
        { topicId: 'topic-c', createdAt: 2 },
      ]);
      vi.spyOn(db, 'getAllRecents').mockResolvedValue([{ topicId: 'topic-a', viewedAt: 1 }]);
      vi.spyOn(db, 'getAllNotes').mockResolvedValue([{ topicId: 'topic-a', text: 'a note', updatedAt: 1 }]);

      await useUserDataStore.getState().loadUserData();

      const state = useUserDataStore.getState();
      expect(state.progress.get('topic-a')).toBe('mastered');
      expect([...state.favorites]).toEqual(['topic-c', 'topic-b']);
      expect(state.recents).toEqual([{ topicId: 'topic-a', viewedAt: 1 }]);
      expect(state.notes.get('topic-a')).toBe('a note');
      expect(state.isLoaded).toBe(true);
    });

    it('sets isLoaded true even when the underlying db calls resolve with empty defaults', async () => {
      vi.spyOn(db, 'getAllProgress').mockResolvedValue([]);
      vi.spyOn(db, 'getAllFavorites').mockResolvedValue([]);
      vi.spyOn(db, 'getAllRecents').mockResolvedValue([]);
      vi.spyOn(db, 'getAllNotes').mockResolvedValue([]);

      await useUserDataStore.getState().loadUserData();
      expect(useUserDataStore.getState().isLoaded).toBe(true);
    });
  });
});
