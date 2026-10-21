import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Format token QR (ringkas supaya QR mudah terbaca kamera):
 *   AZ1.<tipe>.<siswaId>.<kegiatan>.<tanggal>.<exp>.<tanda tangan>
 * tipe d = dinamis (tampil di layar, berlaku 60 detik)
 * tipe c = kartu cetak (tetap, tanpa kedaluwarsa, wajib disertai foto)
 */
const PREFIX = 'AZ1';

function secret(): string {
  const s = process.env.QR_SECRET;
  if (!s || s.length < 16) throw new Error('QR_SECRET belum diisi (minimal 16 karakter, disarankan 32+).');
  return s;
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url').slice(0, 22);
}

export function buatTokenDinamis(siswaId: string, kegiatan: string, tanggal: string, ttlDetik = 60): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDetik;
  const isi = `d.${siswaId}.${kegiatan}.${tanggal}.${exp}`;
  return `${PREFIX}.${isi}.${sign(isi)}`;
}

export function buatTokenKartu(siswaId: string): string {
  const isi = `c.${siswaId}.-.-.0`;
  return `${PREFIX}.${isi}.${sign(isi)}`;
}

export type HasilQr =
  | { ok: true; tipe: 'd' | 'c'; siswaId: string; kegiatan: string; tanggal: string }
  | { ok: false; alasan: string };

export function verifikasiToken(token: string): HasilQr {
  const bagian = token.trim().split('.');
  if (bagian.length !== 7 || bagian[0] !== PREFIX) return { ok: false, alasan: 'QR tidak dikenali' };
  const [, tipe, siswaId, kegiatan, tanggal, exp, sig] = bagian;
  if (tipe !== 'd' && tipe !== 'c') return { ok: false, alasan: 'QR tidak dikenali' };
  const isi = `${tipe}.${siswaId}.${kegiatan}.${tanggal}.${exp}`;
  const benar = sign(isi);
  const a = Buffer.from(sig);
  const b = Buffer.from(benar);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, alasan: 'QR tidak valid' };
  if (tipe === 'd' && Math.floor(Date.now() / 1000) > Number(exp)) {
    return { ok: false, alasan: 'QR sudah kedaluwarsa, minta siswa memuat ulang QR' };
  }
  return { ok: true, tipe, siswaId, kegiatan, tanggal };
}
