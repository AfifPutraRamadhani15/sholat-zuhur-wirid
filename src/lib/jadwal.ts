import type { SupabaseClient } from '@supabase/supabase-js';
import type { Kegiatan, StatusAbsen } from './types';
import { LABEL_KEGIATAN } from './types';

export const TZ = 'Asia/Jakarta';

export interface WaktuWIB {
  tanggal: string; // YYYY-MM-DD
  jam: string; // HH:mm
  detik: number; // detik sejak 00:00
  hari: number; // 1 = Senin ... 7 = Minggu
}

const HARI_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function nowWIB(d: Date = new Date()): WaktuWIB {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hh = Number(get('hour'));
  const mm = Number(get('minute'));
  const ss = Number(get('second'));
  return {
    tanggal: `${get('year')}-${get('month')}-${get('day')}`,
    jam: `${get('hour')}:${get('minute')}`,
    detik: hh * 3600 + mm * 60 + ss,
    hari: HARI_MAP[get('weekday')] ?? 0,
  };
}

export function toMenit(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function tambahHari(tanggal: string, n: number): string {
  const d = new Date(`${tanggal}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function hariDariTanggal(tanggal: string): number {
  const g = new Date(`${tanggal}T12:00:00Z`).getUTCDay();
  return g === 0 ? 7 : g;
}

export const NAMA_HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export function formatTanggalID(tanggal: string): string {
  const d = new Date(`${tanggal}T12:00:00Z`);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatJamWIB(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(iso))
    .replace(/\./g, ':');
}

/* ---------------------------------------------------------------- Pengaturan */

export interface PengaturanZuhur {
  buka: string;
  tepat: string;
  tutup: string;
  hari: number[];
}

export const DEFAULT_ZUHUR: PengaturanZuhur = { buka: '12:00', tepat: '12:30', tutup: '13:00', hari: [1, 2, 3, 4] };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function ambilPengaturanZuhur(sb: SupabaseClient): Promise<PengaturanZuhur> {
  const { data } = await sb
    .from('pengaturan')
    .select('key,value')
    .in('key', ['zuhur_buka', 'zuhur_tepat', 'zuhur_tutup', 'zuhur_hari']);
  const m = new Map<string, string>((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const hari = (m.get('zuhur_hari') ?? '')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => x >= 1 && x <= 7);
  const ok = (v: string | undefined, d: string) => (v && HHMM.test(v) ? v : d);
  return {
    buka: ok(m.get('zuhur_buka'), DEFAULT_ZUHUR.buka),
    tepat: ok(m.get('zuhur_tepat'), DEFAULT_ZUHUR.tepat),
    tutup: ok(m.get('zuhur_tutup'), DEFAULT_ZUHUR.tutup),
    hari: hari.length ? hari : DEFAULT_ZUHUR.hari,
  };
}

/* ------------------------------------------------------------------- Jendela */

export interface Jendela {
  kegiatan: Kegiatan;
  tanggal: string;
  buka: string;
  tepat: string;
  tutup: string;
  label: string;
  catatan?: string | null;
}

export type StateJendela = 'belum_dibuka' | 'hadir' | 'terlambat' | 'ditutup';

/** Jendela waktu kegiatan pada tanggal tertentu, atau null jika hari itu tidak ada kegiatan. */
export async function jendelaKegiatan(
  sb: SupabaseClient,
  kegiatan: Kegiatan,
  tanggal: string,
): Promise<Jendela | null> {
  if (kegiatan === 'zuhur') {
    const z = await ambilPengaturanZuhur(sb);
    if (!z.hari.includes(hariDariTanggal(tanggal))) return null;
    return { kegiatan, tanggal, buka: z.buka, tepat: z.tepat, tutup: z.tutup, label: LABEL_KEGIATAN.zuhur };
  }
  const { data } = await sb.from('jadwal_wirid').select('*').eq('tanggal', tanggal).maybeSingle();
  if (!data) return null;
  return {
    kegiatan,
    tanggal,
    buka: data.jam_mulai,
    tepat: data.jam_tepat_waktu,
    tutup: data.jam_tutup,
    label: LABEL_KEGIATAN.wirid,
    catatan: data.catatan,
  };
}

/** Status jendela pada saat ini (dihitung sampai detik; batas tutup berlaku tepat di jam tutup). */
export function stateJendela(j: Jendela, now: WaktuWIB): StateJendela {
  if (j.tanggal !== now.tanggal) return j.tanggal < now.tanggal ? 'ditutup' : 'belum_dibuka';
  if (now.detik < toMenit(j.buka) * 60) return 'belum_dibuka';
  if (now.detik <= toMenit(j.tepat) * 60) return 'hadir';
  if (now.detik <= toMenit(j.tutup) * 60) return 'terlambat';
  return 'ditutup';
}

export function pesanState(j: Jendela, s: StateJendela): string {
  if (s === 'belum_dibuka') return `Absen ${j.label} dibuka pukul ${j.buka} WIB`;
  if (s === 'ditutup') return `Absen ${j.label} sudah ditutup (batas ${j.tutup} WIB)`;
  if (s === 'terlambat') return `Absen ${j.label} masih dibuka, tetapi dihitung terlambat (sampai ${j.tutup} WIB)`;
  return `Absen ${j.label} dibuka sampai ${j.tepat} WIB (lewat itu dihitung terlambat, tutup ${j.tutup} WIB)`;
}

/** Semua kegiatan yang ada pada tanggal tertentu (Zuhur dan/atau Wirid). */
export async function kegiatanPadaTanggal(sb: SupabaseClient, tanggal: string): Promise<Jendela[]> {
  const out: Jendela[] = [];
  for (const k of ['zuhur', 'wirid'] as Kegiatan[]) {
    const j = await jendelaKegiatan(sb, k, tanggal);
    if (j) out.push(j);
  }
  return out;
}

/* --------------------------------------------------------- Rentang tanggal */

export interface HariKegiatan {
  tanggal: string;
  kegiatan: Kegiatan;
  jendela: Jendela;
  selesai: boolean; // sudah lewat jam tutup, jadi siswa tanpa catatan dihitung Alfa
}

export async function daftarKegiatan(sb: SupabaseClient, dari: string, sampai: string, sekarang: Date = new Date()): Promise<HariKegiatan[]> {
  const now = nowWIB(sekarang);
  const z = await ambilPengaturanZuhur(sb);
  const { data: wirid } = await sb
    .from('jadwal_wirid')
    .select('*')
    .gte('tanggal', dari)
    .lte('tanggal', sampai)
    .order('tanggal');
  const out: HariKegiatan[] = [];
  const selesai = (tanggal: string, tutup: string) =>
    tanggal < now.tanggal || (tanggal === now.tanggal && now.detik > toMenit(tutup) * 60);

  let t = dari;
  let guard = 0;
  while (t <= sampai && guard < 400) {
    if (t <= now.tanggal && z.hari.includes(hariDariTanggal(t))) {
      out.push({
        tanggal: t,
        kegiatan: 'zuhur',
        jendela: { kegiatan: 'zuhur', tanggal: t, buka: z.buka, tepat: z.tepat, tutup: z.tutup, label: LABEL_KEGIATAN.zuhur },
        selesai: selesai(t, z.tutup),
      });
    }
    t = tambahHari(t, 1);
    guard++;
  }
  for (const w of wirid ?? []) {
    if (w.tanggal > now.tanggal) continue;
    out.push({
      tanggal: w.tanggal,
      kegiatan: 'wirid',
      jendela: {
        kegiatan: 'wirid',
        tanggal: w.tanggal,
        buka: w.jam_mulai,
        tepat: w.jam_tepat_waktu,
        tutup: w.jam_tutup,
        label: LABEL_KEGIATAN.wirid,
        catatan: w.catatan,
      },
      selesai: selesai(w.tanggal, w.jam_tutup),
    });
  }
  out.sort((a, b) => (a.tanggal === b.tanggal ? a.kegiatan.localeCompare(b.kegiatan) : a.tanggal < b.tanggal ? -1 : 1));
  return out;
}

export interface RekapSiswa {
  total: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  haid: number;
  alfa: number;
}

/** Rekap kehadiran satu siswa. Kegiatan yang sudah selesai tanpa catatan dihitung Alfa. */
export async function rekapSiswa(sb: SupabaseClient, siswaId: string, dari: string, sampai: string): Promise<RekapSiswa> {
  const hk = (await daftarKegiatan(sb, dari, sampai)).filter((h) => h.selesai);
  const { data } = await sb
    .from('absensi')
    .select('tanggal,kegiatan,status')
    .eq('siswa_id', siswaId)
    .gte('tanggal', dari)
    .lte('tanggal', sampai);
  const peta = new Map<string, StatusAbsen>();
  for (const r of data ?? []) peta.set(`${r.tanggal}|${r.kegiatan}`, r.status as StatusAbsen);
  const rekap: RekapSiswa = { total: hk.length, hadir: 0, terlambat: 0, izin: 0, sakit: 0, haid: 0, alfa: 0 };
  for (const h of hk) {
    const s = peta.get(`${h.tanggal}|${h.kegiatan}`) ?? 'alfa';
    rekap[s] += 1;
  }
  return rekap;
}

export function awalBulan(tanggal: string): string {
  return `${tanggal.slice(0, 7)}-01`;
}