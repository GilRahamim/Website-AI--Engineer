import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazily constructed and memoized — never thrown at module-evaluation time.
// Golden rule 3 (kb-app/CLAUDE.md): the app must work fully without an
// account or network, so an absent/unconfigured Supabase project (no real
// .env — the common case until Phase 5 sub-project #3) must never crash the
// app. createClient() DOES validate its URL synchronously (contrary to this
// sub-project's original design assumption) — a missing/empty URL throws
// immediately, so construction is deferred to first use and skipped
// entirely when either value is missing.
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client === undefined) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    client = url && anonKey ? createClient(url, anonKey) : null;
  }
  return client;
}

/** Test-only: clears the memoized client so each test starts from a clean
 *  slate. Not used by application code. */
export function __resetSupabaseForTests(): void {
  client = undefined;
}
