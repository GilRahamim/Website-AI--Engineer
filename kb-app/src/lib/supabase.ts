import { createClient } from '@supabase/supabase-js';

// The anon key is safe to expose client-side — Row-Level Security (added in
// Phase 5 sub-project #3) is the actual security boundary, not key secrecy.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
