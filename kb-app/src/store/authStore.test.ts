import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockSignOut = vi.fn();

const mockClient = {
  auth: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
};

const mockGetSupabase = vi.fn<() => typeof mockClient | null>(() => mockClient);

// Full module replacement (not vi.spyOn on the real client) — this test file
// never needs a real, network-capable Supabase client, so there's no reason
// to depend on .env.test's placeholder values resolving to anything.
vi.mock('../lib/supabase', () => ({
  getSupabase: () => mockGetSupabase(),
}));

const { useAuthStore, __resetAuthStoreForTests } = await import('./authStore');

beforeEach(() => {
  mockGetSupabase.mockReset().mockReturnValue(mockClient);
  mockGetSession.mockReset().mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockReset();
  mockSignInWithOtp.mockReset().mockResolvedValue({ error: null });
  mockSignOut.mockReset().mockResolvedValue({ error: null });
  useAuthStore.setState({ email: null, status: 'idle', errorMessage: null });
  __resetAuthStoreForTests();
});

describe('authStore', () => {
  it('init() sets email from an existing session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { email: 'a@b.com' } } } });
    useAuthStore.getState().init();
    await waitFor(() => expect(useAuthStore.getState().email).toBe('a@b.com'));
  });

  it('init() has no session -> email stays null', async () => {
    useAuthStore.getState().init();
    await waitFor(() => expect(mockGetSession).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().email).toBeNull();
  });

  it('init() subscribes once and updates email when the auth state changes later', () => {
    useAuthStore.getState().init();
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    const callback = mockOnAuthStateChange.mock.calls[0][0];
    callback('SIGNED_IN', { user: { email: 'c@d.com' } });
    expect(useAuthStore.getState().email).toBe('c@d.com');
  });

  it('init() clears email when the auth state changes to signed out', () => {
    useAuthStore.setState({ email: 'x@y.com' });
    useAuthStore.getState().init();
    const callback = mockOnAuthStateChange.mock.calls[0][0];
    callback('SIGNED_OUT', null);
    expect(useAuthStore.getState().email).toBeNull();
  });

  it('init() no-ops when no Supabase project is configured', () => {
    mockGetSupabase.mockReturnValue(null);
    useAuthStore.getState().init();
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockOnAuthStateChange).not.toHaveBeenCalled();
  });

  it('init() only subscribes once even if called twice (StrictMode double-invoke guard)', () => {
    useAuthStore.getState().init();
    useAuthStore.getState().init();
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('sendMagicLink sets status to sending immediately, then sent on success', async () => {
    const promise = useAuthStore.getState().sendMagicLink('a@b.com');
    expect(useAuthStore.getState().status).toBe('sending');
    await promise;
    expect(useAuthStore.getState().status).toBe('sent');
  });

  it('sendMagicLink passes emailRedirectTo as the current window origin', async () => {
    await useAuthStore.getState().sendMagicLink('a@b.com');
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.com',
      options: { emailRedirectTo: window.location.origin },
    });
  });

  it('sendMagicLink sets status to error with a fixed generic message on failure, never the raw error', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'some raw supabase error detail' } });
    await useAuthStore.getState().sendMagicLink('a@b.com');
    expect(useAuthStore.getState().status).toBe('error');
    expect(useAuthStore.getState().errorMessage).toBe('שליחת הקישור נכשלה. נסה שוב.');
    expect(useAuthStore.getState().errorMessage).not.toContain('some raw supabase error detail');
  });

  it('sendMagicLink sets a generic error (not an unhandled rejection) when signInWithOtp throws', async () => {
    mockSignInWithOtp.mockRejectedValue(new Error('network exploded'));
    await useAuthStore.getState().sendMagicLink('a@b.com');
    expect(useAuthStore.getState().status).toBe('error');
    expect(useAuthStore.getState().errorMessage).toBe('שליחת הקישור נכשלה. נסה שוב.');
  });

  it('sendMagicLink sets a generic error when no Supabase project is configured', async () => {
    mockGetSupabase.mockReturnValue(null);
    await useAuthStore.getState().sendMagicLink('a@b.com');
    expect(useAuthStore.getState().status).toBe('error');
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it('signOut calls supabase.auth.signOut', async () => {
    await useAuthStore.getState().signOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('signOut does nothing when no Supabase project is configured', async () => {
    mockGetSupabase.mockReturnValue(null);
    await expect(useAuthStore.getState().signOut()).resolves.toBeUndefined();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
