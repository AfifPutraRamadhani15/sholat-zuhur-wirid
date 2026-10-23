import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { jalankanPengingatPush, pushAktif } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function berhak(req: Request): boolean {
  const rahasia = process.env.CRON_SECRET;
  if (!rahasia || rahasia.length < 16) return false;
  const header = req.headers.get('authorization');
  const query = new URL(req.url).searchParams.get('secret');
  return header === `Bearer ${rahasia}` || query === rahasia;
}

/**
 * Dipanggil penjadwal luar (misalnya cron-job.org) tiap 5 menit.
 * Mengirim notifikasi pengingat ke layar HP siswa 1 jam sebelum absen dibuka (sekali per siswa per kegiatan).
 * Wajib menyertakan CRON_SECRET (header Authorization: Bearer ... atau ?secret=...).
 */
export async function GET(req: Request) {
  if (!berhak(req)) return NextResponse.json({ ok: false, error: 'Tidak berhak' }, { status: 401 });
  if (!pushAktif()) return NextResponse.json({ ok: true, dilewati: 'Kunci VAPID belum diisi' });
  try {
    const r = await jalankanPengingatPush(supabaseAdmin());
    return NextResponse.json(r, { status: r.ok ? 200 : 500, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}