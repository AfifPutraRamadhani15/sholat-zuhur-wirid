import { NextResponse } from 'next/server';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buatTokenDinamis } from '@/lib/qr';
import { jendelaKegiatan, nowWIB, pesanState, stateJendela } from '@/lib/jadwal';
import { LABEL_KEGIATAN } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const p = await apiProfile(['siswa']);
  if (!p) return NextResponse.json({ ok: false, pesan: 'Sesi habis, silakan masuk lagi' }, { status: 403 });
  const k = new URL(req.url).searchParams.get('kegiatan');
  if (k !== 'zuhur' && k !== 'wirid') return NextResponse.json({ ok: false, pesan: 'Kegiatan tidak dikenal' }, { status: 400 });

  const now = nowWIB();
  const j = await jendelaKegiatan(supabaseAdmin(), k, now.tanggal);
  if (!j) return NextResponse.json({ ok: false, pesan: `Hari ini tidak ada kegiatan ${LABEL_KEGIATAN[k]}` });

  return NextResponse.json({
    ok: true,
    token: buatTokenDinamis(p.id, k, now.tanggal, 60),
    ttl: 60,
    state: stateJendela(j, now),
    pesan: pesanState(j, stateJendela(j, now)),
  });
}
