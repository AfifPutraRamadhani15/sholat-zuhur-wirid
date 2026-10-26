import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { idPengguna } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { prosesScan } from '@/lib/scan';
import { boleh } from '@/lib/ratelimit';
import type { Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

const skema = z.object({
  token: z.string().min(10).max(400),
  kegiatan: z.enum(['zuhur', 'wirid']).optional(),
  foto: z.string().max(900_000).optional(),
});

const gagal = (pesan: string, status = 200) => NextResponse.json({ ok: false, pesan }, { status });

// Profil pemindai disimpan singkat di memori (20 detik) supaya setiap scan tidak perlu bertanya ke database.
const cachePemindai = new Map<string, { exp: number; profil: Profile }>();

async function pemindaiSah(): Promise<Profile | null> {
  const id = await idPengguna(await supabaseServer());
  if (!id) return null;
  const sekarang = Date.now();
  const c = cachePemindai.get(id);
  if (c && c.exp > sekarang) return c.profil;
  const { data } = await supabaseAdmin().from('profiles').select('*').eq('id', id).maybeSingle();
  const p = data as Profile | null;
  if (!p || p.status !== 'aktif' || (p.role !== 'guru' && p.role !== 'admin')) {
    cachePemindai.delete(id);
    return null;
  }
  cachePemindai.set(id, { exp: sekarang + 20_000, profil: p });
  if (cachePemindai.size > 200) for (const [k, v] of cachePemindai) if (v.exp <= sekarang) cachePemindai.delete(k);
  return p;
}

export async function POST(req: Request) {
  const mulai = new Date();
  const scanner = await pemindaiSah();
  if (!scanner) return gagal('Sesi habis atau tidak berhak. Silakan masuk lagi.', 403);
  if (!boleh(`scan:${scanner.id}`, 300, 60_000)) return gagal('Terlalu banyak pemindaian dalam semenit, tunggu sebentar', 429);

  const body = skema.safeParse(await req.json().catch(() => null));
  if (!body.success) return gagal('Data pemindaian tidak valid', 400);

  const hasil = await prosesScan(supabaseAdmin(), scanner, body.data, mulai);
  // Foto, notifikasi, dan log dikerjakan setelah respons dikirim, jadi tidak membuat pemindai menunggu
  if (hasil.lanjut) after(hasil.lanjut);
  return NextResponse.json({ ...hasil.body, ms: Date.now() - mulai.getTime() }, { status: hasil.status });
}