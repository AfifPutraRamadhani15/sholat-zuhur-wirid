import type { SupabaseClient } from '@supabase/supabase-js';
import { verifikasiToken } from './qr';
import { jendelaKegiatan, kegiatanPadaTanggal, nowWIB, pesanState, stateJendela, toMenit } from './jadwal';
import { kirimNotif } from './chatbot';
import { kirimKonfirmasiPush } from './push';
import { audit } from './audit';
import { satu } from './util';
import { hitungPoin } from './poin';
import { LABEL_KEGIATAN, LABEL_STATUS, type Kegiatan, type StatusAbsen } from './types';

export interface InputScan {
  token: string;
  kegiatan?: Kegiatan;
  foto?: string;
}

export interface HasilScan {
  status: number;
  body: Record<string, unknown>;
  /** Pekerjaan susulan (foto, notifikasi, log) yang dijalankan SETELAH respons dikirim ke pemindai. */
  lanjut?: () => Promise<void>;
}

export interface DepsScan {
  audit: typeof audit;
  kirimPush: typeof kirimKonfirmasiPush;
  kirimNotif: typeof kirimNotif;
}

const DEPS: DepsScan = { audit, kirimPush: kirimKonfirmasiPush, kirimNotif };

const gagal = (pesan: string): HasilScan => ({ status: 200, body: { ok: false, pesan } });

export function dekodeFoto(foto?: string): Buffer | null {
  if (!foto) return null;
  const buf = Buffer.from(foto.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  return buf.length > 0 && buf.length <= 650_000 ? buf : null;
}

/**
 * Jalur kilat: hanya 3 panggilan database sebelum respons (profil + jadwal berjalan paralel, lalu simpan).
 * Duplikat dicegah oleh aturan unik di database, jadi tidak perlu pemeriksaan terpisah.
 */
export async function prosesScan(
  sb: SupabaseClient,
  scanner: { id: string },
  input: InputScan,
  mulai: Date = new Date(),
  deps: DepsScan = DEPS,
): Promise<HasilScan> {
  const v = verifikasiToken(input.token);
  if (!v.ok) return gagal(v.alasan);
  const now = nowWIB(mulai);

  let kegiatanPasti: Kegiatan | null = null;
  if (v.tipe === 'd') {
    if (v.tanggal !== now.tanggal) return gagal('QR ini bukan untuk hari ini');
    kegiatanPasti = v.kegiatan === 'wirid' ? 'wirid' : 'zuhur';
  } else if (input.kegiatan) {
    kegiatanPasti = input.kegiatan;
  }

  const [{ data: siswa }, daftar] = await Promise.all([
    sb.from('profiles').select('id,nama,status,role,siswa_detail(kelas:kelas_id(nama))').eq('id', v.siswaId).maybeSingle(),
    kegiatanPasti
      ? jendelaKegiatan(sb, kegiatanPasti, now.tanggal).then((j) => (j ? [j] : []))
      : kegiatanPadaTanggal(sb, now.tanggal),
  ]);

  if (!siswa || siswa.role !== 'siswa') return gagal('Siswa tidak ditemukan');
  if (siswa.status !== 'aktif') return gagal(`Akun ${siswa.nama} belum aktif`);
  type Rel = { nama: string };
  type Det = { kelas?: Rel | Rel[] | null };
  const det = satu(siswa.siswa_detail as unknown as Det | Det[] | null);
  const kelas: string | null = satu(det?.kelas ?? undefined)?.nama ?? null;

  if (!daftar.length) {
    return gagal(kegiatanPasti ? `Hari ini tidak ada kegiatan ${LABEL_KEGIATAN[kegiatanPasti]}` : 'Hari ini tidak ada kegiatan Zuhur maupun Wirid');
  }
  const j = kegiatanPasti ? daftar[0] : (daftar.find((x) => ['hadir', 'terlambat'].includes(stateJendela(x, now))) ?? daftar[0]);
  const kegiatan = j.kegiatan;
  const state = stateJendela(j, now);
  if (state === 'belum_dibuka' || state === 'ditutup') return gagal(pesanState(j, state));
  const status: StatusAbsen = state === 'hadir' ? 'hadir' : 'terlambat';

  // poin: makin cepat scan setelah jam buka, makin besar bonusnya
  const menitScan = Math.floor(now.detik / 60);
  const poin = hitungPoin(status, menitScan - toMenit(j.buka), toMenit(j.tepat) - toMenit(j.buka));

  const fotoBuf = dekodeFoto(input.foto);
  if (!fotoBuf && v.tipe === 'c') return gagal('Foto bukti gagal diambil. Pastikan kamera aktif, lalu pindai ulang.');

  const { data: baris, error: eIns } = await sb
    .from('absensi')
    .insert({
      siswa_id: siswa.id,
      kegiatan,
      tanggal: now.tanggal,
      status,
      poin,
      scanned_at: mulai.toISOString(),
      metode: v.tipe === 'c' ? 'kartu' : 'qr_layar',
      foto_path: null,
      scanner_id: scanner.id,
    })
    .select('id')
    .single();
  if (eIns || !baris) {
    if (eIns?.code === '23505') {
      const { data: ada } = await sb
        .from('absensi')
        .select('status')
        .eq('siswa_id', siswa.id)
        .eq('kegiatan', kegiatan)
        .eq('tanggal', now.tanggal)
        .maybeSingle();
      const st = ada ? LABEL_STATUS[ada.status as StatusAbsen] : null;
      return gagal(`${siswa.nama} sudah tercatat${st ? ` ${st}` : ''} untuk ${LABEL_KEGIATAN[kegiatan]} hari ini`);
    }
    return gagal('Gagal menyimpan absensi, coba lagi');
  }

  const jam = now.jam;
  const isi =
    `Absen ${LABEL_KEGIATAN[kegiatan]} kamu tercatat pukul ${jam} WIB dengan status ${LABEL_STATUS[status]}.` +
    (status === 'terlambat' ? ' Besok usahakan datang lebih awal ya.' : ' Terima kasih sudah hadir tepat waktu.') +
    ` Kamu dapat +${poin} poin.`;

  const lanjut = async () => {
    const foto = async () => {
      if (!fotoBuf) return;
      const path = `${now.tanggal}/${kegiatan}/${siswa.id}.jpg`;
      const { error } = await sb.storage.from('bukti-absensi').upload(path, fotoBuf, { contentType: 'image/jpeg', upsert: true });
      if (!error) await sb.from('absensi').update({ foto_path: path }).eq('id', baris.id);
    };
    const notifChat = async () => {
      await deps.kirimNotif(sb, siswa.id, isi);
      const selesai = new Date();
      await sb.from('absensi').update({ notif_sent_at: selesai.toISOString(), latency_ms: selesai.getTime() - mulai.getTime() }).eq('id', baris.id);
    };
    const push = () => deps.kirimPush(sb, { siswaId: siswa.id, kegiatan, tanggal: now.tanggal, jam, status });
    const catat = () =>
      deps.audit(scanner.id, 'scan', `absensi:${baris.id}`, { siswa: siswa.nama, kegiatan, status, poin, metode: v.tipe === 'c' ? 'kartu' : 'qr_layar' });
    // semuanya berjalan bersamaan; kegagalan satu bagian tidak mengganggu yang lain
    await Promise.allSettled([foto(), notifChat(), push(), catat()]);
  };

  return {
    status: 200,
    body: {
      ok: true,
      pesan: `${LABEL_KEGIATAN[kegiatan]} tercatat`,
      nama: siswa.nama,
      kelas,
      status,
      statusLabel: LABEL_STATUS[status],
      kegiatan,
      jam,
      poin,
    },
    lanjut,
  };
}