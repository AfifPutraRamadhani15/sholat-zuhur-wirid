import { toMenit } from './jadwal';
import type { Kegiatan, StatusAbsen } from './types';

/* ===================================================================== aturan poin
 *  Poin dihitung per bulan (mulai dari 0 tiap awal bulan) dan tidak pernah kurang dari 0.
 *  - Hadir tepat waktu : makin cepat scan setelah absen dibuka, makin besar poin (maks sampai min di batas tepat waktu)
 *  - Terlambat         : poin kecil tetap
 *  - Bonus beruntun    : +1 untuk tiap kegiatan berturut-turut yang dihadiri (maks BONUS_BERUNTUN_MAKS)
 *  - Izin/sakit/haid   : tidak menambah dan tidak mengurangi, rangkaian beruntun tidak putus
 *  - Alfa              : -POTONGAN_ALFA per kegiatan, rangkaian beruntun kembali ke 0
 *  - Hari tanpa kegiatan (libur: tidak ada satu pun siswa yang absen) tidak dihitung
 */
export const POIN = {
  zuhur: { maks: 10, min: 5, terlambat: 2 },
  wirid: { maks: 15, min: 8, terlambat: 4 },
} as const;
export const BONUS_BERUNTUN_MAKS = 5;
export const POTONGAN_ALFA = 1;

export interface Kejadian {
  tanggal: string;
  kegiatan: Kegiatan;
  buka: string;
  tepat: string;
  tutup: string;
  selesai: boolean;
}

export interface Catat {
  status: StatusAbsen;
  /** detik sejak 00.00 WIB saat dipindai */
  detik: number;
}

export interface RincianHari {
  tanggal: string;
  kegiatan: Kegiatan;
  status: StatusAbsen;
  poin: number;
}

export interface HasilPoin {
  poin: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  haid: number;
  alfa: number;
  streak: number;
  /** persen hadir dari kegiatan yang wajib (izin/sakit/haid tidak dihitung); null jika belum ada */
  skor: number | null;
  /** persen tepat waktu dari yang hadir; null jika belum pernah hadir */
  ketepatan: number | null;
  rincian: RincianHari[];
}

export const kunciKejadian = (tanggal: string, kegiatan: string) => `${tanggal}|${kegiatan}`;

/** Detik sejak 00.00 WIB dari waktu ISO (WIB = UTC+7 tetap). */
export function detikWIB(iso: string): number {
  return (Math.floor(new Date(iso).getTime() / 1000) + 7 * 3600) % 86400;
}

/** Poin satu kali scan, tanpa bonus beruntun. */
export function poinScan(kegiatan: Kegiatan, status: 'hadir' | 'terlambat', detikScan: number, buka: string, tepat: string): number {
  const p = POIN[kegiatan];
  if (status === 'terlambat') return p.terlambat;
  const b = toMenit(buka) * 60;
  const t = toMenit(tepat) * 60;
  const f = t > b ? Math.min(1, Math.max(0, (detikScan - b) / (t - b))) : 0;
  return Math.round(p.maks - f * (p.maks - p.min));
}

export function hitungPoin(
  kejadian: Kejadian[],
  catatan: Map<string, Catat>,
  berlangsung: Set<string>,
  mulai: string,
): HasilPoin {
  const urut = [...kejadian].sort((a, b) => (a.tanggal === b.tanggal ? toMenit(a.buka) - toMenit(b.buka) : a.tanggal < b.tanggal ? -1 : 1));
  const h: HasilPoin = { poin: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, haid: 0, alfa: 0, streak: 0, skor: null, ketepatan: null, rincian: [] };

  for (const k of urut) {
    if (k.tanggal < mulai) continue; // sebelum siswa terdaftar
    const kunci = kunciKejadian(k.tanggal, k.kegiatan);
    const rec = catatan.get(kunci);
    if (!rec && !(k.selesai && berlangsung.has(kunci))) continue; // belum selesai, atau hari itu tidak ada kegiatan (libur)

    let delta = 0;
    let status: StatusAbsen;
    if (rec && (rec.status === 'hadir' || rec.status === 'terlambat')) {
      status = rec.status;
      delta = poinScan(k.kegiatan, rec.status, rec.detik, k.buka, k.tepat) + Math.min(h.streak, BONUS_BERUNTUN_MAKS);
      h.streak += 1;
      h[rec.status] += 1;
    } else if (rec && (rec.status === 'izin' || rec.status === 'sakit' || rec.status === 'haid')) {
      status = rec.status;
      h[rec.status] += 1; // tidak mengubah poin maupun rangkaian
    } else {
      status = 'alfa';
      delta = -POTONGAN_ALFA;
      h.streak = 0;
      h.alfa += 1;
    }
    const sebelum = h.poin;
    h.poin = Math.max(0, h.poin + delta);
    h.rincian.push({ tanggal: k.tanggal, kegiatan: k.kegiatan, status, poin: h.poin - sebelum });
  }

  const hadirTotal = h.hadir + h.terlambat;
  const wajib = hadirTotal + h.alfa;
  h.skor = wajib > 0 ? Math.round((hadirTotal / wajib) * 100) : null;
  h.ketepatan = hadirTotal > 0 ? Math.round((h.hadir / hadirTotal) * 100) : null;
  return h;
}

/** Perkiraan poin jika siswa memindai sekarang (termasuk bonus beruntun). null jika absen belum dibuka atau sudah ditutup. */
export function poinJikaSekarang(
  kegiatan: Kegiatan,
  state: 'belum_dibuka' | 'hadir' | 'terlambat' | 'ditutup',
  detikSekarang: number,
  buka: string,
  tepat: string,
  streak: number,
): number | null {
  if (state !== 'hadir' && state !== 'terlambat') return null;
  return poinScan(kegiatan, state, detikSekarang, buka, tepat) + Math.min(streak, BONUS_BERUNTUN_MAKS);
}

export interface PesertaPapan {
  id: string;
  nama: string;
  kelas: string | null;
  poin: number;
  skor: number | null;
}

/** Urutan peringkat: poin terbanyak; jika sama, skor kehadiran lebih tinggi; jika masih sama, urut nama. */
export function urutkanPapan(peserta: PesertaPapan[]): PesertaPapan[] {
  return [...peserta].sort((a, b) => b.poin - a.poin || (b.skor ?? -1) - (a.skor ?? -1) || a.nama.localeCompare(b.nama, 'id'));
}