import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { fullSync, pullSince, pushDirty } from '../lib/sync';

const DIRTY_PUSH_DEBOUNCE_MS = 3000;
const PULL_INTERVAL_MS = 60_000;

interface SyncState {
  status: 'idle' | 'synced';
  lastSyncedAt: number | null;
  start: () => void;
  scheduleDirtyPush: () => void;
  syncNow: () => Promise<void>;
}

let started = false;
let dirtyTimeoutId: ReturnType<typeof setTimeout> | null = null;
let pullIntervalId: ReturnType<typeof setInterval> | null = null;
let lastPullAt = 0;
let handleFocus: (() => void) | null = null;
let handleOnline: (() => void) | null = null;
let handleVisibilityChange: (() => void) | null = null;
let unsubscribeAuth: (() => void) | null = null;

export const useSyncStore = create<SyncState>()((set) => {
  function markSynced() {
    set({ status: 'synced', lastSyncedAt: Date.now() });
  }

  function beginAutoSync() {
    void fullSync().then(() => {
      lastPullAt = Date.now();
      markSynced();
    });

    pullIntervalId = setInterval(() => {
      void pullSince(lastPullAt).then(() => {
        lastPullAt = Date.now();
        markSynced();
      });
    }, PULL_INTERVAL_MS);

    handleFocus = () => {
      void pullSince(lastPullAt).then(() => {
        lastPullAt = Date.now();
        markSynced();
      });
    };
    handleOnline = () => {
      void fullSync().then(() => {
        lastPullAt = Date.now();
        markSynced();
      });
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
  }

  function endAutoSync() {
    if (pullIntervalId !== null) {
      clearInterval(pullIntervalId);
      pullIntervalId = null;
    }
    if (handleFocus) {
      window.removeEventListener('focus', handleFocus);
      handleFocus = null;
    }
    if (handleOnline) {
      window.removeEventListener('online', handleOnline);
      handleOnline = null;
    }
  }

  return {
    status: 'idle',
    lastSyncedAt: null,

    // Guarded against React 19 StrictMode's double-invoked mount effect (and
    // HMR) registering a second authStore subscription with no way to
    // unsubscribe — same pattern as authStore.init()'s `initialized` guard.
    start: () => {
      if (started) return;
      started = true;

      // Belt-and-suspenders: covers the (currently hypothetical) case where
      // authStore's session already resolved before this runs, in addition
      // to the normal case below where the subscription catches it.
      if (useAuthStore.getState().email) {
        beginAutoSync();
      }

      unsubscribeAuth = useAuthStore.subscribe((state, prevState) => {
        if (!prevState.email && state.email) beginAutoSync();
        else if (prevState.email && !state.email) endAutoSync();
      });

      handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden' && dirtyTimeoutId !== null) {
          clearTimeout(dirtyTimeoutId);
          dirtyTimeoutId = null;
          void pushDirty().then(markSynced);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
    },

    // Safe to call regardless of sign-in state — pushDirty() itself already
    // no-ops instantly when signed out, so this never needs to check.
    scheduleDirtyPush: () => {
      if (dirtyTimeoutId !== null) {
        clearTimeout(dirtyTimeoutId);
      }
      dirtyTimeoutId = setTimeout(() => {
        dirtyTimeoutId = null;
        void pushDirty().then(markSynced);
      }, DIRTY_PUSH_DEBOUNCE_MS);
    },

    syncNow: async () => {
      await fullSync();
      lastPullAt = Date.now();
      markSynced();
    },
  };
});

/** Test-only: resets start()'s idempotence guard and all module-level
 *  timer/listener state so each test starts from a clean slate. Not used by
 *  application code. */
export function __resetSyncStoreForTests(): void {
  started = false;
  if (unsubscribeAuth) {
    unsubscribeAuth();
    unsubscribeAuth = null;
  }
  if (dirtyTimeoutId !== null) {
    clearTimeout(dirtyTimeoutId);
    dirtyTimeoutId = null;
  }
  if (pullIntervalId !== null) {
    clearInterval(pullIntervalId);
    pullIntervalId = null;
  }
  if (handleFocus) {
    window.removeEventListener('focus', handleFocus);
    handleFocus = null;
  }
  if (handleOnline) {
    window.removeEventListener('online', handleOnline);
    handleOnline = null;
  }
  if (handleVisibilityChange) {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    handleVisibilityChange = null;
  }
  lastPullAt = 0;
}
