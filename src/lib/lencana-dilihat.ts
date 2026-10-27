import type { Lencana } from './lencana';

/**
 * Logika "sudah dilihat" untuk penanda merah, seperti notifikasi pada umumnya:
 * penanda menampilkan jumlah yang BARU sejak menu terakhir dibuka. Setelah menu diklik, penanda hilang,
 * lalu muncul lagi hanya jika ada tambahan baru.
 */
export type Kunci = keyof Lencana;
export type Dilihat = Partial<Record<Kunci, { n: number; p: string }>>;

const DAFTAR: Kunci[] = ['akun', 'izin', 'alfa', 'wirid'];

/**
 * Masa berlaku catatan "sudah dilihat":
 *  akun, izin : tidak dibatasi waktu (pengajuan menumpuk sampai diselesaikan)
 *  alfa       : per hari (alfa dihitung ulang tiap hari)
 *  wirid      : per bulan (pengingat mengisi jadwal muncul lagi bulan depan)
 */
export function periode(kunci: Kunci, sekarang: Date = new Date()): string {
  if (kunci === 'akun' || kunci === 'izin') return '';
  const tgl = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(sekarang);
  return kunci === 'wirid' ? tgl.slice(0, 7) : tgl;
}

/** Angka yang ditampilkan pada penanda. */
export function jumlahBaru(kunci: Kunci, data: Lencana, dilihat: Dilihat, sekarang?: Date): number {
  const d = dilihat[kunci];
  const sudah = d && d.p === periode(kunci, sekarang) ? d.n : 0;
  return Math.max(0, data[kunci] - sudah);
}

/** Menandai satu menu sebagai sudah dilihat pada jumlah saat ini. */
export function tandaiDilihat(dilihat: Dilihat, kunci: Kunci, data: Lencana, sekarang?: Date): Dilihat {
  return { ...dilihat, [kunci]: { n: data[kunci], p: periode(kunci, sekarang) } };
}

/**
 * Merapikan catatan setiap kali data baru datang: jika jumlah turun (misalnya akun disetujui),
 * catatan ikut turun supaya tambahan berikutnya tetap terhitung baru. Mengembalikan objek yang sama jika tidak ada perubahan.
 */
export function rapikanDilihat(dilihat: Dilihat, data: Lencana, sekarang?: Date): Dilihat {
  let berubah = false;
  const hasil: Dilihat = {};
  for (const k of DAFTAR) {
    const d = dilihat[k];
    if (!d) continue;
    if (d.p !== periode(k, sekarang)) {
      berubah = true; // periode lewat (hari atau bulan berganti): catatan dibuang
      continue;
    }
    const n = Math.min(d.n, data[k]);
    if (n !== d.n) berubah = true;
    hasil[k] = { n, p: d.p };
  }
  return berubah ? hasil : dilihat;
}

export function bacaDilihat(penyimpan: Pick<Storage, 'getItem'>, kunciSimpan: string): Dilihat {
  try {
    const mentah = JSON.parse(penyimpan.getItem(kunciSimpan) ?? '{}') as Record<string, unknown>;
    const out: Dilihat = {};
    for (const k of DAFTAR) {
      const d = mentah[k] as { n?: unknown; p?: unknown } | undefined;
      if (d && typeof d.n === 'number' && Number.isFinite(d.n) && d.n >= 0 && typeof d.p === 'string') out[k] = { n: d.n, p: d.p };
    }
    return out;
  } catch {
    return {};
  }
}

export function simpanDilihat(penyimpan: Pick<Storage, 'setItem'>, kunciSimpan: string, dilihat: Dilihat): void {
  try {
    penyimpan.setItem(kunciSimpan, JSON.stringify(dilihat));
  } catch {
    /* penyimpanan penuh atau diblokir: penanda tetap berfungsi, hanya tidak diingat setelah ditutup */
  }
}