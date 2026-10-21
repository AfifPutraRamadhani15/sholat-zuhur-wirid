/** Hasil relasi Supabase bisa berupa objek atau array berisi satu objek. */
export function satu<T>(x: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(x)) return x[0];
  return x ?? undefined;
}

export function pesanDari(sp: { msg?: string; err?: string }) {
  return { msg: sp.msg, err: sp.err };
}
