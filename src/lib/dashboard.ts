import type { SupabaseClient } from '@supabase/supabase-js';
import { LABEL_KEGIATAN, type Kegiatan, type StatusAbsen } from './types';
import {
  daftarKegiatan,
  formatJamWIB,
  formatTanggalID,
  hariDariTanggal,
  kegiatanPadaTanggal,
  NAMA_HARI,
  nowWIB,
  stateJendela,
  tambahHari,
  toMenit,
  type Jendela,
  type StateJendela,
} from './jadwal';
import { satu } from './util';

/* ------------------------------------------------------------------ tipe */

export type Seg = StatusAbsen | 'belum';

export type KelasSnap = { id: string; nama: string; total: number } & Record<Seg, number>;

export interface KegiatanSnap {
  kegiatan: Kegiatan;
  label: string;
  buka: string;
  tepat: string;
  tutup: string;
  state: StateJendela;
  selesai: boolean;
  total: number;
  hitung: Record<Seg, number>;
  persenHadir: number;
  perKelas: KelasSnap[];
  garis: { t: string; v: number }[];
}

export interface TrenSnap {
  tanggal: string;
  label: string;
  hari: string;
  kegiatan: Kegiatan;
  persen: number;
  hadir: number;
  total: number;
}

export interface TerbaruSnap {
  jam: string;
  nama: string;
  kegiatan: Kegiatan;
  status: StatusAbsen;
  oleh: string;
}

export interface Snapshot {
  tanggal: string;
  tanggalLabel: string;
  jam: string;
  totalSiswa: number;
  akunMenunggu: number;
  izinMenunggu: number;
  kegiatan: KegiatanSnap[];
  tren: TrenSnap[];
  terbaru: TerbaruSnap[];
}

export interface SiswaRingkas {
  id: string;
  kelasId: string | null;
}

export interface BarisAbsen {
  siswa_id: string;
  status: string;
  scanned_at: string;
  metode: string;
}

const STATUS_VALID: StatusAbsen[] = ['hadir', 'terlambat', 'izin', 'sakit', 'haid', 'alfa'];

/* ------------------------------------------------------ fungsi hitung murni */

/** Menit sejak 00.00 WIB dari waktu ISO (WIB = UTC+7 tetap, tanpa DST). */
export function menitWIB(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 60000 + 420) % 1440;
}

function jamTeks(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Kurva kumulatif jumlah pemindaian dari jam buka sampai sekarang (atau sampai tutup jika sudah selesai). */
export function buatGaris(menitScan: number[], buka: number, tutup: number, sekarang: number, selesai: boolean) {
  const durasi = Math.max(tutup - buka, 5);
  const langkah = Math.max(5, Math.ceil(durasi / 24 / 5) * 5);
  const urut = [...menitScan].sort((a, b) => a - b);
  const titik: { t: string; v: number }[] = [];
  let t = buka;
  let i = 0;
  let kum = 0;
  for (;;) {
    while (i < urut.length && urut[i] <= t) {
      kum += 1;
      i += 1;
    }
    titik.push({ t: jamTeks(t), v: kum });
    if (t >= tutup) break;
    if (!selesai && t >= sekarang) break;
    t = Math.min(t + langkah, tutup);
  }
  return titik;
}

export function hitungKegiatan(
  j: Jendela,
  state: StateJendela,
  baris: BarisAbsen[],
  siswa: SiswaRingkas[],
  namaKelas: Record<string, string>,
  sekarangMenit: number,
): KegiatanSnap {
  const selesai = state === 'ditutup';
  const kosong = (): Record<Seg, number> => ({ hadir: 0, terlambat: 0, izin: 0, sakit: 0, haid: 0, alfa: 0, belum: 0 });

  const kelasDari = new Map<string, string>();
  const peta = new Map<string, KelasSnap>();
  for (const s of siswa) {
    const id = s.kelasId ?? '-';
    kelasDari.set(s.id, id);
    let k = peta.get(id);
    if (!k) {
      k = { id, nama: id === '-' ? 'Tanpa kelas' : namaKelas[id] ?? 'Kelas', total: 0, ...kosong() };
      peta.set(id, k);
    }
    k.total += 1;
  }

  const sudah = new Set<string>();
  const menit: number[] = [];
  for (const b of baris) {
    const kid = kelasDari.get(b.siswa_id);
    if (kid === undefined || sudah.has(b.siswa_id)) continue;
    if (!STATUS_VALID.includes(b.status as StatusAbsen)) continue;
    sudah.add(b.siswa_id);
    peta.get(kid)![b.status as StatusAbsen] += 1;
    if (b.metode === 'qr_layar' || b.metode === 'kartu') menit.push(menitWIB(b.scanned_at));
  }

  const hitung = kosong();
  for (const k of peta.values()) {
    const tercatat = k.hadir + k.terlambat + k.izin + k.sakit + k.haid + k.alfa;
    const belum = Math.max(k.total - tercatat, 0);
    if (selesai) {
      k.alfa += belum; // lewat batas terlambat: tanpa catatan dihitung Alfa
      k.belum = 0;
    } else {
      k.belum = belum;
    }
    for (const s of [...STATUS_VALID, 'belum'] as Seg[]) hitung[s] += k[s];
  }

  const total = siswa.length;
  return {
    kegiatan: j.kegiatan,
    label: j.label,
    buka: j.buka,
    tepat: j.tepat,
    tutup: j.tutup,
    state,
    selesai,
    total,
    hitung,
    persenHadir: total ? Math.round(((hitung.hadir + hitung.terlambat) / total) * 100) : 0,
    perKelas: [...peta.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id', { numeric: true })),
    garis: buatGaris(menit, toMenit(j.buka), toMenit(j.tutup), sekarangMenit, selesai),
  };
}

export function buatTren(
  hk: { tanggal: string; kegiatan: Kegiatan }[],
  baris: { siswa_id: string; tanggal: string; kegiatan: string; status: string }[],
  aktif: Set<string>,
  total: number,
): TrenSnap[] {
  const hadir = new Map<string, number>();
  for (const b of baris) {
    if (!aktif.has(b.siswa_id)) continue;
    if (b.status !== 'hadir' && b.status !== 'terlambat') continue;
    const key = `${b.tanggal}|${b.kegiatan}`;
    hadir.set(key, (hadir.get(key) ?? 0) + 1);
  }
  return hk.map((h) => {
    const n = hadir.get(`${h.tanggal}|${h.kegiatan}`) ?? 0;
    return {
      tanggal: h.tanggal,
      label: `${h.tanggal.slice(8, 10)}/${h.tanggal.slice(5, 7)}`,
      hari: NAMA_HARI[hariDariTanggal(h.tanggal)],
      kegiatan: h.kegiatan,
      persen: total ? Math.min(100, Math.round((n / total) * 100)) : 0,
      hadir: n,
      total,
    };
  });
}

/* ------------------------------------------------------- akses data + cache */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Baris = any;

/** Supabase membatasi 1000 baris per permintaan, jadi data dibaca per halaman. */
async function semua(
  buat: (dari: number, sampai: number) => PromiseLike<{ data: Baris[] | null; error: unknown }>,
): Promise<Baris[]> {
  const out: Baris[] = [];
  for (let i = 0; i < 30; i++) {
    const { data, error } = await buat(i * 1000, i * 1000 + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const simpan = new Map<string, { exp: number; val: unknown }>();

/** Cache singkat di memori server supaya polling tiap beberapa detik tidak membebani database gratis. */
async function ingat<T>(kunci: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const c = simpan.get(kunci);
  if (c && c.exp > now) return c.val as T;
  const val = await fn();
  simpan.set(kunci, { exp: now + ttlMs, val });
  if (simpan.size > 50) {
    for (const [k, v] of simpan) if (v.exp <= now) simpan.delete(k);
  }
  return val;
}

async function ambilSiswaAktif(sb: SupabaseClient): Promise<SiswaRingkas[]> {
  const rows = await semua((a, b) =>
    sb.from('profiles').select('id,siswa_detail(kelas_id)').eq('role', 'siswa').eq('status', 'aktif').order('id').range(a, b),
  );
  return rows.map((r: Baris) => ({
    id: r.id as string,
    kelasId: (satu(r.siswa_detail)?.kelas_id ?? null) as string | null,
  }));
}

async function ambilNamaKelas(sb: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await sb.from('kelas').select('id,nama');
  const out: Record<string, string> = {};
  for (const k of data ?? []) out[k.id as string] = k.nama as string;
  return out;
}

async function ambilTren(sb: SupabaseClient, tanggal: string, aktif: Set<string>, total: number): Promise<TrenSnap[]> {
  const hk = (await daftarKegiatan(sb, tambahHari(tanggal, -21), tanggal)).filter((h) => h.selesai).slice(-10);
  if (!hk.length) return [];
  const dari = hk[0].tanggal;
  const baris = await semua((a, b) =>
    sb.from('absensi').select('siswa_id,tanggal,kegiatan,status').gte('tanggal', dari).lte('tanggal', tanggal).order('id').range(a, b),
  );
  return buatTren(hk, baris, aktif, total);
}

/** Ringkasan lengkap untuk dashboard admin (dipakai halaman dan endpoint polling). */
export async function ambilSnapshot(sb: SupabaseClient): Promise<Snapshot> {
  const now = nowWIB();
  const sekarangMenit = Math.floor(now.detik / 60);

  const [list, siswa, namaKelas, akun, izin, terbaruRaw] = await Promise.all([
    kegiatanPadaTanggal(sb, now.tanggal),
    ingat('siswaAktif', 30_000, () => ambilSiswaAktif(sb)),
    ingat('namaKelas', 30_000, () => ambilNamaKelas(sb)),
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'menunggu'),
    sb.from('izin').select('id', { count: 'exact', head: true }).eq('status', 'menunggu'),
    sb
      .from('absensi')
      .select('status,kegiatan,scanned_at,metode,siswa:profiles!absensi_siswa_id_fkey(nama),scanner:profiles!absensi_scanner_id_fkey(nama)')
      .order('scanned_at', { ascending: false })
      .limit(10),
  ]);

  const aktif = new Set(siswa.map((s) => s.id));

  const kegiatan = await Promise.all(
    list.map(async (j) => {
      const baris = await semua((a, b) =>
        sb
          .from('absensi')
          .select('siswa_id,status,scanned_at,metode')
          .eq('tanggal', now.tanggal)
          .eq('kegiatan', j.kegiatan)
          .order('id')
          .range(a, b),
      );
      return hitungKegiatan(j, stateJendela(j, now), baris, siswa, namaKelas, sekarangMenit);
    }),
  );

  const tren = await ingat(`tren:${now.tanggal}:${siswa.length}`, 60_000, () => ambilTren(sb, now.tanggal, aktif, siswa.length));

  const terbaru: TerbaruSnap[] = (terbaruRaw.data ?? []).map((r: Baris) => ({
    jam: formatJamWIB(r.scanned_at),
    nama: satu(r.siswa)?.nama ?? '-',
    kegiatan: r.kegiatan as Kegiatan,
    status: r.status as StatusAbsen,
    oleh: satu(r.scanner)?.nama ?? (r.metode === 'izin' ? 'Izin disetujui' : r.metode === 'manual' ? 'Input manual' : '-'),
  }));

  void LABEL_KEGIATAN;
  return {
    tanggal: now.tanggal,
    tanggalLabel: formatTanggalID(now.tanggal),
    jam: now.jam,
    totalSiswa: siswa.length,
    akunMenunggu: akun.count ?? 0,
    izinMenunggu: izin.count ?? 0,
    kegiatan,
    tren,
    terbaru,
  };
}