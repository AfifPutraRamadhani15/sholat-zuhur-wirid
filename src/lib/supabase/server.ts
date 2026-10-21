import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Klien Supabase berbasis cookie sesi pengguna (dipakai di server component dan route handler). */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // dipanggil dari server component: abaikan, middleware yang menyegarkan sesi
          }
        },
      },
    },
  );
}
