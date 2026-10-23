import type { CookieOptions } from '@supabase/ssr';

/**
 * Menjadikan cookie sesi login sebagai cookie sesi browser (hilang saat browser ditutup).
 * Penghapusan cookie (saat logout) dibiarkan apa adanya supaya tetap berfungsi.
 */
export function opsiSesi(value: string, options?: CookieOptions): CookieOptions {
  if (!value || options?.maxAge === 0) return options ?? {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { maxAge, expires, ...sisa } = options ?? {};
  return sisa;
}