import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('lib/supabase', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('getSupabase() returns null, and never throws, when env vars are unset', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { getSupabase } = await import('./supabase');
    expect(() => getSupabase()).not.toThrow();
    expect(getSupabase()).toBeNull();
  });

  it('getSupabase() returns a real client when env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    const { getSupabase } = await import('./supabase');
    expect(getSupabase()).not.toBeNull();
  });

  it('getSupabase() memoizes — returns the same instance on repeat calls', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    const { getSupabase } = await import('./supabase');
    expect(getSupabase()).toBe(getSupabase());
  });
});
