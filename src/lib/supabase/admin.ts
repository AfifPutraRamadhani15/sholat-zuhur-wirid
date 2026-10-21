import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** Klien dengan service role. HANYA dipakai di server. Melewati RLS, jadi selalu cek peran dulu. */
export function supabaseAdmin(): SupabaseClient {
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cached;
}
