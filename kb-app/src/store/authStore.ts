import { create } from 'zustand';
import { getSupabase } from '../lib/supabase';

interface AuthState {
  email: string | null;
  status: 'idle' | 'sending' | 'sent' | 'error';
  errorMessage: string | null;

  init: () => void;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const GENERIC_ERROR = 'שליחת הקישור נכשלה. נסה שוב.';

let initialized = false;

export const useAuthStore = create<AuthState>()((set) => ({
  email: null,
  status: 'idle',
  errorMessage: null,

  // Synchronous: only sets up the subscription and kicks off an initial
  // read. Guarded against React 19 StrictMode's double-invoked mount effect
  // (and HMR) registering a second onAuthStateChange subscription with no
  // way to unsubscribe. No-ops entirely when no Supabase project is
  // configured (getSupabase() returns null) — signed-out behavior is
  // unaffected either way, matching golden rule 3. The onAuthStateChange
  // subscription is also what picks up a completed magic-link sign-in:
  // Supabase's client auto-detects the session from the URL when the user
  // lands back on the app after clicking the email link, firing this same
  // callback.
  init: () => {
    if (initialized) return;
    initialized = true;
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      set({ email: data.session?.user.email ?? null });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ email: session?.user.email ?? null });
    });
  },

  sendMagicLink: async (email) => {
    const supabase = getSupabase();
    if (!supabase) {
      // No project configured — same fixed message as a real failure, no
      // raw internals leaked either way.
      set({ status: 'error', errorMessage: GENERIC_ERROR });
      return;
    }
    set({ status: 'sending', errorMessage: null });
    try {
      // emailRedirectTo: without it, Supabase redirects to the project's
      // default Site URL (e.g. its localhost:3000 default) instead of back
      // to this app.
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        // Fixed, generic message — never the raw Supabase error (Global
        // Constraints), matching Settings.tsx's existing "קובץ לא תקין" pattern.
        set({ status: 'error', errorMessage: GENERIC_ERROR });
      } else {
        set({ status: 'sent' });
      }
    } catch {
      // signInWithOtp rethrows non-AuthError failures instead of returning
      // them as { error } — without this catch, an unhandled rejection
      // would leave status stuck at 'sending' forever.
      set({ status: 'error', errorMessage: GENERIC_ERROR });
    }
  },

  // email is cleared by the onAuthStateChange subscription from init(), not
  // set directly here — one source of truth for session state.
  signOut: async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch {
      // Best-effort — nothing else to do locally; there's no local state to
      // roll back (email is only ever cleared via the subscription).
    }
  },
}));

/** Test-only: resets the init() idempotence guard so each test starts from
 *  a clean slate. Not used by application code. */
export function __resetAuthStoreForTests(): void {
  initialized = false;
}
