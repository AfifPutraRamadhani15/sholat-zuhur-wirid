import { NextResponse } from 'next/server';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { kegiatanPadaTanggal, nowWIB, pesanState, stateJendela } from '@/lib/jadwal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const p = await apiProfile(['guru', 'admin']);
  if (!p) return NextResponse.json({ ok: false }, { status: 403 });
  const now = nowWIB();
  const list = await kegiatanPadaTanggal(supabaseAdmin(), now.tanggal);
  return NextResponse.json({
    ok: true,
    tanggal: now.tanggal,
    jam: now.jam,
    kegiatan: list.map((j) => {
      const state = stateJendela(j, now);
      return { kegiatan: j.kegiatan, label: j.label, buka: j.buka, tepat: j.tepat, tutup: j.tutup, state, pesan: pesanState(j, state) };
    }),
  });
}
