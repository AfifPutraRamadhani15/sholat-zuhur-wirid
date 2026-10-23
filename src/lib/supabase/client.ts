import { createBrowserClient } from '@supabase/ssr';

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return document.cookie
            .split('; ')
            .filter(Boolean)
            .map((c) => {
              const i = c.indexOf('=');
              return { name: c.slice(0, i), value: decodeURIComponent(c.slice(i + 1)) };
            });
        },
        setAll(list) {
          const aman = location.protocol === 'https:' ? '; Secure' : '';
          list.forEach(({ name, value, options }) => {
            // value kosong atau maxAge 0 = hapus cookie; selain itu = cookie sesi (tanpa umur)
            const hapus = !value || options?.maxAge === 0;
            document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax${aman}${hapus ? '; max-age=0' : ''}`;
          });
        },
      },
    },
  );
}