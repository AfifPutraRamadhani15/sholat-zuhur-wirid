import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';
import { supabaseAdmin } from './supabase/admin';
import type { Profile, Role } from './types';

export function homeFor(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'guru') return '/guru';
  return '/siswa';
}

/** Profil pengguna yang sedang login (null jika belum login). */
export async function getSessionProfile(): Promise<Profile | null> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseAdmin().from('profiles').select('*').eq('id', user.id).maybeSingle();
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
