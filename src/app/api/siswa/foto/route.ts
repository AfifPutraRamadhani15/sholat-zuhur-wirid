import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TGL = /^\d{4}-\d{2}-\d{2}$/;

/** Foto bukti scan milik siswa yang sedang login. Alamatnya tetap (tidak berganti tiap dibuka), jadi bisa disimpan peramban. */
export async function GET(req: Request) {
  const p = await apiProfile(['siswa']);
  if (!p) return new Response('Tidak berhak', { status: 403 });
  const u = new URL(req.url);
  const tanggal = u.searchParams.get('tanggal') ?? '';
  const kegiatan = u.searchParams.get('kegiatan');
  if (!TGL.test(tanggal) || (kegiatan !== 'zuhur' && kegiatan !== 'wirid')) return new Response('Permintaan tidak valid', { status: 400 });

  const sb = supabaseAdmin();
  const { data } = await sb
    .from('absensi')
    .select('foto_path')
    .eq('siswa_id', p.id) // hanya foto milik sendiri
    .eq('tanggal', tanggal)
    .eq('kegiatan', kegiatan)
    .maybeSingle();
  if (!data?.foto_path) return new Response('Foto belum tersedia', { status: 404, headers: { 'Cache-Control': 'no-store' } });

  const { data: berkas, error } = await sb.storage.from('bukti-absensi').download(data.foto_path);
  if (error || !berkas) return new Response('Foto belum tersedia', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(await berkas.arrayBuffer(), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
  });
}