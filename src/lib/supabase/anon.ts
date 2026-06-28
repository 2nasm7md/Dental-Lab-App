import { createClient } from '@supabase/supabase-js';

/**
 * Anonymous Supabase client — used to render public tenant content under /c/[slug].
 * Cookies are deliberately not wired up so no session leaks into the public surface.
 */
export function createSupabaseAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
