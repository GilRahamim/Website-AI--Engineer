import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockSignOut = vi.fn();

// Full module replacement (not vi.spyOn on the real client) — this test file
// never needs a real, network-capable Supabase client, so there's no reason
// to depend on .env.test's placeholder values resolving to anything.
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

const { useAuthStore } = await import('./authStore');

beforeEach(() => {
  mockGetSession.mockReset().mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockReset();
  mockSignInWithOtp.mockReset().mockResolvedValue({ error: null });
  mockSignOut.mockReset().mockResolvedValue({ error: null });
  useAuthStore.setState({ email: null, status: 'idle', errorMessage: null });
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

  it('sendMagicLink sets status to sending immediately, then sent on success', async () => {
    const promise = useAuthStore.getState().sendMagicLink('a@b.com');
    expect(useAuthStore.getState().status).toBe('sending');
    await promise;
    expect(useAuthStore.getState().status).toBe('sent');
    expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'a@b.com' });
  });

  it('sendMagicLink sets status to error with a fixed generic message on failure, never the raw error', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'some raw supabase error detail' } });
    await useAuthStore.getState().sendMagicLink('a@b.com');
    expect(useAuthStore.getState().status).toBe('error');
    expect(useAuthStore.getState().errorMessage).toBe('שליחת הקישור נכשלה. נסה שוב.');
    expect(useAuthStore.getState().errorMessage).not.toContain('some raw supabase error detail');
  });

  it('signOut calls supabase.auth.signOut', async () => {
    await useAuthStore.getState().signOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
