import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { useUserDataStore } from './userDataStore';

vi.mock('../lib/sync', () => ({
  fullSync: vi.fn(() => Promise.resolve()),
  pushDirty: vi.fn(() => Promise.resolve()),
  pullSince: vi.fn(() => Promise.resolve()),
}));

const { fullSync, pushDirty, pullSince } = await import('../lib/sync');
const { useSyncStore, __resetSyncStoreForTests } = await import('./syncStore');

let loadUserDataSpy: ReturnType<typeof vi.spyOn>;

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(fullSync).mockClear().mockResolvedValue(undefined);
  vi.mocked(pushDirty).mockClear().mockResolvedValue(undefined);
  vi.mocked(pullSince).mockClear().mockResolvedValue(undefined);
  useAuthStore.setState({ email: null, status: 'idle', errorMessage: null });
  useSyncStore.setState({ status: 'idle', lastSyncedAt: null });
  __resetSyncStoreForTests();
  loadUserDataSpy = vi.spyOn(useUserDataStore.getState(), 'loadUserData').mockResolvedValue(undefined);
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('syncStore — start()', () => {
  it('does nothing while signed out', () => {
    useSyncStore.getState().start();
    expect(fullSync).not.toHaveBeenCalled();
    vi.advanceTimersByTime(120_000);
    expect(pullSince).not.toHaveBeenCalled();
  });

  it('begins auto-sync immediately if already signed in when start() is called', async () => {
    useAuthStore.setState({ email: 'a@b.com' });
    useSyncStore.getState().start();
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));
    expect(loadUserDataSpy).toHaveBeenCalled();
  });

  it('a null->value email transition triggers fullSync and starts the pull interval', async () => {
    useSyncStore.getState().start();
    expect(fullSync).not.toHaveBeenCalled();

    useAuthStore.setState({ email: 'a@b.com' });
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(60_000);
    expect(pullSince).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(pullSince).toHaveBeenCalledTimes(2);
    expect(loadUserDataSpy).toHaveBeenCalled();
  });

  it('a value->null email transition (sign-out) stops the pull interval', async () => {
    useAuthStore.setState({ email: 'a@b.com' });
    useSyncStore.getState().start();
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));

    useAuthStore.setState({ email: null });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(pullSince).not.toHaveBeenCalled();
  });

  it('calling start() twice only registers one subscription (idempotent)', async () => {
    useSyncStore.getState().start();
    useSyncStore.getState().start();
    useAuthStore.setState({ email: 'a@b.com' });
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));
    expect(fullSync).toHaveBeenCalledTimes(1); // not 2
  });

  it('a focus event while signed in triggers an immediate pull', async () => {
    useAuthStore.setState({ email: 'a@b.com' });
    useSyncStore.getState().start();
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(pullSince).toHaveBeenCalledTimes(1));
    expect(loadUserDataSpy).toHaveBeenCalled();
  });

  it('an online event while signed in triggers a full sync', async () => {
    useAuthStore.setState({ email: 'a@b.com' });
    useSyncStore.getState().start();
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(2));
    expect(loadUserDataSpy).toHaveBeenCalled();
  });

  it('updates status and lastSyncedAt after a successful sync', async () => {
    useAuthStore.setState({ email: 'a@b.com' });
    useSyncStore.getState().start();
    await vi.waitFor(() => expect(useSyncStore.getState().status).toBe('synced'));
    expect(useSyncStore.getState().lastSyncedAt).toEqual(expect.any(Number));
  });
});

describe('syncStore — scheduleDirtyPush()', () => {
  it('multiple rapid calls within the debounce window result in exactly one pushDirty call', async () => {
    useSyncStore.getState().scheduleDirtyPush();
    vi.advanceTimersByTime(1000);
    useSyncStore.getState().scheduleDirtyPush();
    vi.advanceTimersByTime(1000);
    useSyncStore.getState().scheduleDirtyPush();

    await vi.advanceTimersByTimeAsync(3000);
    expect(pushDirty).toHaveBeenCalledTimes(1);
  });

  it('fires after the debounce window elapses with no further calls', async () => {
    useSyncStore.getState().scheduleDirtyPush();
    await vi.advanceTimersByTimeAsync(3000);
    expect(pushDirty).toHaveBeenCalledTimes(1);
    expect(loadUserDataSpy).toHaveBeenCalled();
  });

  it('a call while signed out still resolves harmlessly (no thrown error)', async () => {
    expect(() => useSyncStore.getState().scheduleDirtyPush()).not.toThrow();
    await vi.advanceTimersByTimeAsync(3000);
    expect(pushDirty).toHaveBeenCalledTimes(1); // pushDirty itself no-ops internally when signed out
  });

  it('visibilitychange to hidden flushes a pending debounce immediately', async () => {
    useSyncStore.getState().start();
    useSyncStore.getState().scheduleDirtyPush();
    setVisibility('hidden');
    await vi.waitFor(() => expect(pushDirty).toHaveBeenCalledTimes(1));

    // The flushed call shouldn't fire again when the original debounce would have elapsed.
    await vi.advanceTimersByTimeAsync(3000);
    expect(pushDirty).toHaveBeenCalledTimes(1);
  });

  it('visibilitychange to hidden with no pending debounce does nothing', async () => {
    useSyncStore.getState().start();
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(100);
    expect(pushDirty).not.toHaveBeenCalled();
  });
});

describe('syncStore — syncNow()', () => {
  it('calls fullSync and updates lastSyncedAt', async () => {
    await useSyncStore.getState().syncNow();
    expect(fullSync).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().status).toBe('synced');
    expect(useSyncStore.getState().lastSyncedAt).toEqual(expect.any(Number));
    expect(loadUserDataSpy).toHaveBeenCalled();
  });
});
