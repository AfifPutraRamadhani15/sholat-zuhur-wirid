import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServer } from './supabase/server';
import { supabaseAdmin } from './supabase/admin';
import type { Profile, Role } from './types';

export function homeFor(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'guru') return '/guru';
  return '/siswa';
}

/**
 * ID pengguna yang sedang login. Tanda tangan token diperiksa langsung di server (tanpa bertanya ke Supabase),
 * jadi jauh lebih cepat. Jika cara itu tidak tersedia, otomatis memakai pemeriksaan lama lewat jaringan.
 */
export async function idPengguna(sb: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await sb.auth.getClaims();
    const sub = data?.claims?.sub;
    if (typeof sub === 'string' && sub) return sub;
  } catch {
    /* lanjut ke pemeriksaan lewat jaringan */
  }
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.id ?? null;
}

/** Profil pengguna yang sedang login (null jika belum login). */
export async function getSessionProfile(): Promise<Profile | null> {
  const id = await idPengguna(await supabaseServer());
  if (!id) return null;
  const { data } = await supabaseAdmin().from('profiles').select('*').eq('id', id).maybeSingle();
  return (data as Profile | null) ?? null;
}

/** Dipakai di layout/halaman: paksa login, akun aktif, dan peran yang sesuai. */
export async function requireRole(roles: Role[]): Promise<Profile> {
  const p = await getSessionProfile();
  if (!p) redirect('/login');
  if (p.status !== 'aktif') redirect('/menunggu');
  if (!roles.includes(p.role)) redirect(homeFor(p.role));
  return p;
}

/** Dipakai di route handler: kembalikan null jika tidak berhak. */
export async function apiProfile(roles: Role[]): Promise<Profile | null> {
  const p = await getSessionProfile();
  if (!p || p.status !== 'aktif' || !roles.includes(p.role)) return null;
  return p;
}