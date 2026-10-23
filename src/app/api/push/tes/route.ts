import { NextResponse } from 'next/server';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { kirimKePengguna, pushAktif } from '@/lib/push';
import { boleh } from '@/lib/ratelimit';

export const runtime = 'nodejs';

export async function POST() {
  const p = await apiProfile(['siswa', 'guru', 'admin']);
  if (!p) return NextResponse.json({ ok: false, error: 'Sesi habis, silakan masuk lagi' }, { status: 403 });
  if (!pushAktif()) return NextResponse.json({ ok: false, error: 'Notifikasi belum dikonfigurasi di server (kunci VAPID kosong)' }, { status: 503 });
  if (!boleh(`pushtes:${p.id}`, 5, 10 * 60 * 1000)) return NextResponse.json({ ok: false, error: 'Terlalu sering, coba lagi beberapa menit lagi' }, { status: 429 });

  const terkirim = await kirimKePengguna(supabaseAdmin(), p.id, {
    title: 'Tes notifikasi',
    body: 'Jika ini muncul di layar HP, notifikasi absensi sudah aktif.',
    url: '/siswa',
    tag: 'tes-notifikasi',
  });
  if (!terkirim) return NextResponse.json({ ok: false, error: 'Belum ada perangkat yang terdaftar atau pengiriman gagal. Coba matikan lalu aktifkan lagi.' }, { status: 404 });
  return NextResponse.json({ ok: true, terkirim });
}