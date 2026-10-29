import { NextResponse } from 'next/server';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ambilRingkasanSiswa } from '@/lib/ringkasan-siswa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const p = await apiProfile(['siswa']);
  if (!p) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const data = await ambilRingkasanSiswa(supabaseAdmin(), p);
    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}