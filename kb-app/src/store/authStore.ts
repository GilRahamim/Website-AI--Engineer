import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  email: string | null;
  status: 'idle' | 'sending' | 'sent' | 'error';
  errorMessage: string | null;

  init: () => void;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  email: null,
  status: 'idle',
  errorMessage: null,

  // Synchronous: only sets up the subscription and kicks off an initial read.
  // Called once from App.tsx's existing mount effect (Task 4) — no separate
  // effect needed. The onAuthStateChange subscription is also what picks up
  // a completed magic-link sign-in: Supabase's client auto-detects the
  // session from the URL when the user lands back on the app after clicking
  // the email link, firing this same callback.
  init: () => {
    void supabase.auth.getSession().then(({ data }) => {
      set({ email: data.session?.user.email ?? null });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ email: session?.user.email ?? null });
    });
  },

  sendMagicLink: async (email) => {
    set({ status: 'sending', errorMessage: null });
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      // Fixed, generic message — never the raw Supabase error (Global
      // Constraints), matching Settings.tsx's existing "קובץ לא תקין" pattern.
      set({ status: 'error', errorMessage: 'שליחת הקישור נכשלה. נסה שוב.' });
    } else {
      set({ status: 'sent' });
    }
  },

  // email is cleared by the onAuthStateChange subscription from init(), not
  // set directly here — one source of truth for session state.
  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
