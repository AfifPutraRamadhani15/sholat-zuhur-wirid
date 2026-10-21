import { NextResponse } from 'next/server';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatJamWIB, nowWIB } from '@/lib/jadwal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const p = await apiProfile(['siswa']);
  if (!p) return NextResponse.json({ ok: false }, { status: 403 });
  const k = new URL(req.url).searchParams.get('kegiatan');
  if (k !== 'zuhur' && k !== 'wirid') return NextResponse.json({ ok: false }, { status: 400 });
  const { data } = await supabaseAdmin()
    .from('absensi')
    .select('status,scanned_at')
    .eq('siswa_id', p.id)
    .eq('kegiatan', k)
    .eq('tanggal', nowWIB().tanggal)
    .maybeSingle();
  return NextResponse.json({ ok: true, tercatat: !!data, status: data?.status ?? null, jam: data ? formatJamWIB(data.scanned_at) : null });
}
