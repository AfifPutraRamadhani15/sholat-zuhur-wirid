import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { nowWIB } from '@/lib/jadwal';
import { audit } from '@/lib/audit';
import { boleh } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const skema = z.object({
  jenis: z.enum(['sakit', 'izin', 'haid'], { message: 'Pilih jenis pengajuan' }),
  kegiatan: z.enum(['zuhur', 'wirid', 'keduanya'], { message: 'Pilih kegiatan' }),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid'),
  alasan: z.string().trim().min(5, 'Alasan minimal 5 karakter').max(500, 'Alasan maksimal 500 karakter'),
});

const LAMPIRAN_OK = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const gagal = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const p = await apiProfile(['siswa']);
  if (!p) return gagal('Sesi habis, silakan masuk lagi', 403);
  if (!boleh(`izin:${p.id}`, 10, 60 * 60 * 1000)) return gagal('Terlalu banyak pengajuan, coba lagi nanti', 429);

  const fd = await req.formData();
  const parsed = skema.safeParse({
    jenis: fd.get('jenis'),
    kegiatan: fd.get('kegiatan'),
    tanggal: fd.get('tanggal'),
    alasan: fd.get('alasan'),
  });
  if (!parsed.success) return gagal(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  const d = parsed.data;

  const sb = supabaseAdmin();
  const now = nowWIB();
  if (d.tanggal < now.tanggal) return gagal('Pengajuan untuk tanggal yang sudah lewat hanya bisa dilakukan lewat admin');

  if (d.jenis === 'haid') {
    const { data: det } = await sb.from('siswa_detail').select('jenis_kelamin').eq('profile_id', p.id).maybeSingle();
    if (det?.jenis_kelamin !== 'P') return gagal('Pilihan ini hanya untuk siswa perempuan');
  }

  // cegah pengajuan ganda yang bertumpuk
  const { data: ada } = await sb
    .from('izin')
    .select('id,kegiatan')
    .eq('siswa_id', p.id)
    .eq('tanggal', d.tanggal)
    .in('status', ['menunggu', 'disetujui']);
  const bentrok = (ada ?? []).some((r) => r.kegiatan === 'keduanya' || d.kegiatan === 'keduanya' || r.kegiatan === d.kegiatan);
  if (bentrok) return gagal('Kamu sudah punya pengajuan untuk tanggal dan kegiatan ini');

  let lampiranPath: string | null = null;
  const file = fd.get('lampiran');
  if (d.jenis !== 'haid' && file instanceof File && file.size > 0) {
    if (!LAMPIRAN_OK.includes(file.type) || file.size > 2_000_000) {
      return gagal('Lampiran harus JPG, PNG, WebP, atau PDF maksimal 2 MB');
    }
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${p.id}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('lampiran-izin').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (!error) lampiranPath = path;
  }

  const { data: baris, error } = await sb
    .from('izin')
    .insert({ siswa_id: p.id, jenis: d.jenis, kegiatan: d.kegiatan, tanggal: d.tanggal, alasan: d.alasan, lampiran_path: lampiranPath })
    .select('id')
    .single();
  if (error) return gagal('Gagal mengirim pengajuan, coba lagi', 500);

  await audit(p.id, 'izin_diajukan', `izin:${baris.id}`, { jenis: d.jenis, tanggal: d.tanggal, kegiatan: d.kegiatan });
  return NextResponse.json({ ok: true });
}
