import type { SupabaseClient } from '@supabase/supabase-js';
import { kegiatanPadaTanggal, nowWIB, stateJendela } from './jadwal';

/**
 * Angka pada penanda merah di menu admin.
 *  akun   : akun siswa/guru yang menunggu persetujuan
 *  izin   : pengajuan izin yang menunggu persetujuan
 *  alfa   : jumlah alfa hari ini pada kegiatan yang sudah ditutup
 *  wirid  : 1 jika bulan ini belum ada satu pun jadwal wirid (diingatkan lewat tanda "!")
 */
export interface Lencana {
  akun: number;
  izin: number;
  alfa: number;
  wirid: number;
}

export const LENCANA_KOSONG: Lencana = { akun: 0, izin: 0, alfa: 0, wirid: 0 };

/** Tanggal 1 bulan berikutnya, untuk batas pencarian jadwal wirid bulan ini. */
export function awalBulanDepan(tanggal: string): string {
  const tahun = Number(tanggal.slice(0, 4));
  const bulan = Number(tanggal.slice(5, 7));
  return bulan === 12 ? `${tahun + 1}-01-01` : `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`;
}

let cache: { exp: number; val: Lencana } | null = null;

/** Hasil disimpan 4 detik di memori supaya banyak tab admin tidak membebani database gratis. */
export async function ambilLencana(sb: SupabaseClient, sekarang: Date = new Date(), pakaiCache = true): Promise<Lencana> {
  const t = Date.now();
  if (pakaiCache && cache && cache.exp > t) return cache.val;

  const now = nowWIB(sekarang);
  const awal = `${now.tanggal.slice(0, 7)}-01`;
  const [akun, izin, wirid, siswa, list] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'menunggu'),
    sb.from('izin').select('id', { count: 'exact', head: true }).eq('status', 'menunggu'),
    sb.from('jadwal_wirid').select('id', { count: 'exact', head: true }).gte('tanggal', awal).lt('tanggal', awalBulanDepan(now.tanggal)),
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'siswa').eq('status', 'aktif'),
    kegiatanPadaTanggal(sb, now.tanggal),
  ]);

  // Alfa hari ini: siswa aktif tanpa catatan hadir/izin pada kegiatan yang sudah lewat batas terlambat
  const totalSiswa = siswa.count ?? 0;
  let alfa = 0;
  const selesai = list.filter((j) => stateJendela(j, now) === 'ditutup');
  const tercatat = await Promise.all(
    selesai.map((j) =>
      sb
        .from('absensi')
        .select('id', { count: 'exact', head: true })
        .eq('tanggal', now.tanggal)
        .eq('kegiatan', j.kegiatan)
        .in('status', ['hadir', 'terlambat', 'izin', 'sakit', 'haid']),
    ),
  );
  for (const r of tercatat) alfa += Math.max(0, totalSiswa - (r.count ?? 0));

  const val: Lencana = {
    akun: akun.count ?? 0,
    izin: izin.count ?? 0,
    alfa,
    wirid: (wirid.count ?? 0) === 0 ? 1 : 0,
  };
  cache = { exp: t + 4000, val };
  return val;
}

// dipakai uji supaya cache tidak mengganggu
export function _kosongkanCache() {
  cache = null;
}