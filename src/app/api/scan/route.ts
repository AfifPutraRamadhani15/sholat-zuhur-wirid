import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifikasiToken } from '@/lib/qr';
import { jendelaKegiatan, kegiatanPadaTanggal, nowWIB, pesanState, stateJendela } from '@/lib/jadwal';
import { kirimNotif } from '@/lib/chatbot';
import { kirimKonfirmasiPush } from '@/lib/push';
import { audit } from '@/lib/audit';
import { boleh } from '@/lib/ratelimit';
import { satu } from '@/lib/util';
import { LABEL_KEGIATAN, LABEL_STATUS, type Kegiatan } from '@/lib/types';

export const runtime = 'nodejs';

const skema = z.object({
  token: z.string().min(10).max(400),
  kegiatan: z.enum(['zuhur', 'wirid']).optional(),
  foto: z.string().max(900_000).optional(),
});

function gagal(pesan: string, status = 200) {
  return NextResponse.json({ ok: false, pesan }, { status });
}

export async function POST(req: Request) {
  const mulai = new Date();
  const scanner = await apiProfile(['guru', 'admin']);
  if (!scanner) return gagal('Sesi habis atau tidak berhak. Silakan masuk lagi.', 403);
  if (!boleh(`scan:${scanner.id}`, 120, 60_000)) return gagal('Terlalu cepat, tunggu sebentar', 429);

  const body = skema.safeParse(await req.json().catch(() => null));
  if (!body.success) return gagal('Data pemindaian tidak valid', 400);
  const { token, foto } = body.data;

  const v = verifikasiToken(token);
  if (!v.ok) return gagal(v.alasan);

  const sb = supabaseAdmin();
  const now = nowWIB(mulai);

  const { data: siswa } = await sb
    .from('profiles')
    .select('id,nama,status,role,siswa_detail(kelas:kelas_id(nama))')
    .eq('id', v.siswaId)
    .maybeSingle();
  if (!siswa || siswa.role !== 'siswa') return gagal('Siswa tidak ditemukan');
  if (siswa.status !== 'aktif') return gagal(`Akun ${siswa.nama} belum aktif`);
  type Rel = { nama: string };
  type Det = { kelas?: Rel | Rel[] | null };
  const det = satu(siswa.siswa_detail as unknown as Det | Det[] | null);
  const kelas: string | null = satu(det?.kelas ?? undefined)?.nama ?? null;

  // Tentukan kegiatan
  let kegiatan: Kegiatan;
  if (v.tipe === 'd') {
    if (v.tanggal !== now.tanggal) return gagal('QR ini bukan untuk hari ini');
    kegiatan = v.kegiatan === 'wirid' ? 'wirid' : 'zuhur';
  } else if (body.data.kegiatan) {
    kegiatan = body.data.kegiatan;
  } else {
    const hariIni = await kegiatanPadaTanggal(sb, now.tanggal);
    if (!hariIni.length) return gagal('Hari ini tidak ada kegiatan Zuhur maupun Wirid');
    const aktif = hariIni.find((j) => ['hadir', 'terlambat'].includes(stateJendela(j, now)));
    kegiatan = (aktif ?? hariIni[0]).kegiatan;
  }

  const j = await jendelaKegiatan(sb, kegiatan, now.tanggal);
  if (!j) return gagal(`Hari ini tidak ada kegiatan ${LABEL_KEGIATAN[kegiatan]}`);
  const state = stateJendela(j, now);
  if (state === 'belum_dibuka' || state === 'ditutup') return gagal(pesanState(j, state));
  const status = state === 'hadir' ? 'hadir' : 'terlambat';

  // Cegah absen ganda
  const { data: ada } = await sb
    .from('absensi')
    .select('status')
    .eq('siswa_id', siswa.id)
    .eq('kegiatan', kegiatan)
    .eq('tanggal', now.tanggal)
    .maybeSingle();
  if (ada) return gagal(`${siswa.nama} sudah tercatat ${LABEL_STATUS[ada.status as keyof typeof LABEL_STATUS]} untuk ${LABEL_KEGIATAN[kegiatan]} hari ini`);

  // Foto bukti
  let fotoPath: string | null = null;
  if (foto) {
    const base64 = foto.replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(base64, 'base64');
    if (buf.length > 0 && buf.length <= 650_000) {
      const path = `${now.tanggal}/${kegiatan}/${siswa.id}.jpg`;
      const { error } = await sb.storage.from('bukti-absensi').upload(path, buf, { contentType: 'image/jpeg', upsert: true });
      if (!error) fotoPath = path;
    }
  }
  if (!fotoPath && v.tipe === 'c') return gagal('Foto bukti gagal diambil. Pastikan kamera aktif, lalu pindai ulang.');

  const { data: baris, error: eIns } = await sb
    .from('absensi')
    .insert({
      siswa_id: siswa.id,
      kegiatan,
      tanggal: now.tanggal,
      status,
      scanned_at: mulai.toISOString(),
      metode: v.tipe === 'c' ? 'kartu' : 'qr_layar',
      foto_path: fotoPath,
      scanner_id: scanner.id,
    })
    .select('id')
    .single();
  if (eIns) {
    if (eIns.code === '23505') return gagal(`${siswa.nama} sudah tercatat untuk ${LABEL_KEGIATAN[kegiatan]} hari ini`);
    return gagal('Gagal menyimpan absensi, coba lagi');
  }

  // Notifikasi chatbot ke siswa
  const jamTeks = now.jam;
  const isi =
    `Absen ${LABEL_KEGIATAN[kegiatan]} kamu tercatat pukul ${jamTeks} WIB dengan status ${LABEL_STATUS[status]}.` +
    (status === 'terlambat' ? ' Besok usahakan datang lebih awal ya.' : ' Terima kasih sudah hadir tepat waktu.');
  try {
    await kirimNotif(sb, siswa.id, isi);
    const selesai = new Date();
    await sb
      .from('absensi')
      .update({ notif_sent_at: selesai.toISOString(), latency_ms: selesai.getTime() - mulai.getTime() })
      .eq('id', baris.id);
  } catch {
    // notifikasi gagal tidak membatalkan absensi
  }

  // Notifikasi di layar HP siswa berjalan setelah respons dikirim, jadi tidak memperlambat scan
  after(() => kirimKonfirmasiPush(sb, { siswaId: siswa.id, kegiatan, tanggal: now.tanggal, jam: jamTeks, status }));

  await audit(scanner.id, 'scan', `absensi:${baris.id}`, { siswa: siswa.nama, kegiatan, status, metode: v.tipe === 'c' ? 'kartu' : 'qr_layar' });

  return NextResponse.json({
    ok: true,
    pesan: `${LABEL_KEGIATAN[kegiatan]} tercatat`,
    nama: siswa.nama,
    kelas,
    status,
    statusLabel: LABEL_STATUS[status],
    kegiatan,
    jam: jamTeks,
  });
}