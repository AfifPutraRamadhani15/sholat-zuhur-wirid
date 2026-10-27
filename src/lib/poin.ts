import type { SupabaseClient } from '@supabase/supabase-js';
import { daftarKegiatan, nowWIB, tambahHari } from './jadwal';
import { satu } from './util';

/** Hadir tepat waktu 10 + bonus 0-5 (makin cepat setelah jam buka, makin besar). Terlambat 5. */
export function hitungPoin(status: string, menitDariBuka: number, lebarTepat: number): number {
  if (status === 'hadir') {
    const sisa = Math.min(1, Math.max(0, 1 - menitDariBuka / Math.max(lebarTepat, 1)));
    return 10 + Math.round(5 * sisa);
  }
  return status === 'terlambat' ? 5 : 0;
}

export interface Rekap {
  siswaId: string; nama: string; kelas: string | null;
  poin: number; hadir: number; terlambat: number; alfa: number; skor: number;
}

const RIWAYAT_HARI = 90;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Baris = any;

async function semua(buat: (a: number, b: number) => PromiseLike<{ data: Baris[] | null; error: unknown }>) {
  const out: Baris[] = [];
  for (let i = 0; i < 30; i++) {
    const { data, error } = await buat(i * 1000, i * 1000 + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

let cache: { exp: number; val: Rekap[] } | null = null;

export async function hitungRekap(sb: SupabaseClient): Promise<Rekap[]> {
  if (cache && cache.exp > Date.now()) return cache.val;
  const now = nowWIB();
  const dari = tambahHari(now.tanggal, -RIWAYAT_HARI);
  const hariSelesai = [...new Set((await daftarKegiatan(sb, dari, now.tanggal)).filter((h) => h.selesai).map((h) => h.tanggal))];

  const siswa = await semua((a, b) =>
    sb.from('profiles').select('id,nama,created_at,siswa_detail(kelas:kelas_id(nama))')
      .eq('role', 'siswa').eq('status', 'aktif').order('id').range(a, b),
  );
  const absen = await semua((a, b) =>
    sb.from('absensi').select('siswa_id,tanggal,status,poin').gte('tanggal', dari).order('id').range(a, b),
  );

  const per = new Map<string, Baris[]>();
  for (const r of absen) (per.get(r.siswa_id) ?? per.set(r.siswa_id, []).get(r.siswa_id)!).push(r);

  const hasil: Rekap[] = siswa.map((s: Baris) => {
    const rows = per.get(s.id) ?? [];
    const mulai = String(s.created_at ?? '').slice(0, 10);
    let poin = 0, hadir = 0, terlambat = 0, alfa = 0;
    for (const r of rows) {
      if (r.status === 'hadir') { hadir++; poin += r.poin; }
      else if (r.status === 'terlambat') { terlambat++; poin += r.poin; }
      else if (r.status === 'alfa') { alfa++; poin -= 1; }
    }
    const adaHari = new Set(rows.map((r) => r.tanggal));
    for (const t of hariSelesai) if (t >= mulai && !adaHari.has(t)) { alfa++; poin -= 1; }
    const wajib = hadir + terlambat + alfa;
    const det = satu(s.siswa_detail);
    return {
      siswaId: s.id, nama: s.nama, kelas: satu(det?.kelas)?.nama ?? null,
      poin, hadir, terlambat, alfa, skor: wajib ? Math.round(((hadir + terlambat) / wajib) * 100) : 100,
    };
  });
  hasil.sort((a, b) => b.poin - a.poin || b.hadir - a.hadir || a.nama.localeCompare(b.nama));
  cache = { exp: Date.now() + 30_000, val: hasil };
  return hasil;
}

export async function ringkasanSiswa(sb: SupabaseClient, siswaId: string) {
  const semuaRekap = await hitungRekap(sb);
  const idx = semuaRekap.findIndex((r) => r.siswaId === siswaId);
  return { saya: semuaRekap[idx] ?? null, peringkat: idx + 1, jumlah: semuaRekap.length, top3: semuaRekap.slice(0, 3) };
}