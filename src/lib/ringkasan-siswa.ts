import type { SupabaseClient } from '@supabase/supabase-js';
import {
  awalBulan,
  daftarKegiatan,
  toMenit,
  formatJamWIB,
  formatTanggalID,
  nowWIB,
  pesanState,
  stateJendela,
  type Jendela,
  type StateJendela,
} from './jadwal';
import {
  BONUS_BERUNTUN_MAKS,
  POIN,
  POTONGAN_ALFA,
  detikWIB,
  hitungPoin,
  kunciKejadian,
  poinJikaSekarang,
  urutkanPapan,
  type Catat,
  type HasilPoin,
  type Kejadian,
  type PesertaPapan,
} from './poin';
import { LABEL_KEGIATAN, LABEL_STATUS, type Kegiatan, type StatusAbsen } from './types';
import { satu } from './util';

/* ------------------------------------------------------------------------ tipe */

export interface SudahAbsen {
  status: StatusAbsen;
  statusLabel: string;
  jam: string; // HH:mm:ss WIB
  foto: string | null; // alamat foto bukti milik siswa ini; null jika belum selesai diunggah
  pemindai: string | null;
  keterangan: string | null;
  poin: number;
}

export interface ItemHariIni {
  kegiatan: Kegiatan;
  label: string;
  buka: string;
  tepat: string;
  tutup: string;
  state: StateJendela;
  pesan: string;
  sudah: SudahAbsen | null;
  /** kegiatan sudah ditutup, ada yang hadir, tetapi siswa ini tidak absen */
  alfa: boolean;
  poinJikaSekarang: number | null;
}

export interface PapanItem {
  posisi: number;
  nama: string;
  kelas: string | null;
  poin: number;
  saya: boolean;
}

export interface RiwayatItem {
  tanggal: string;
  hari: string;
  kegiatan: Kegiatan;
  status: StatusAbsen;
  jam: string | null;
  poin: number;
  foto: string | null;
}

export interface RingkasanSiswa {
  nama: string;
  tanggal: string;
  tanggalLabel: string;
  bulanLabel: string;
  jam: string;
  hariIni: ItemHariIni[];
  poin: { bulan: number; hariIni: number; streak: number; hadir: number; terlambat: number; izinSakitHaid: number; alfa: number; potonganAlfa: number };
  skor: number | null;
  ketepatan: number | null;
  peringkat: { posisi: number; dari: number };
  papan: PapanItem[];
  riwayat: RiwayatItem[];
  aturan: { zuhur: { maks: number; min: number; terlambat: number }; wirid: { maks: number; min: number; terlambat: number }; bonusMaks: number; potonganAlfa: number };
}

/* ------------------------------------------------------------- akses data + cache */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Baris = any;

async function semua(buat: (a: number, b: number) => PromiseLike<{ data: Baris[] | null; error: unknown }>): Promise<Baris[]> {
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

async function ingat<T>(kunci: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  const c = simpan.get(kunci);
  if (c && c.exp > t) return c.val as T;
  const val = await fn();
  simpan.set(kunci, { exp: t + ttlMs, val });
  if (simpan.size > 20) for (const [k, v] of simpan) if (v.exp <= t) simpan.delete(k);
  return val;
}

export function kosongkanCacheRingkasan() {
  simpan.clear();
}

interface Murid {
  id: string;
  nama: string;
  kelas: string | null;
  mulai: string;
}

interface DataBulan {
  murid: Murid[];
  kejadian: Kejadian[];
  berlangsung: Set<string>;
  hasil: Map<string, HasilPoin>;
}

function bangunDataBulan(
  muridMentah: Baris[],
  baris: Baris[],
  kejadian: Kejadian[],
): DataBulan {
  const murid: Murid[] = muridMentah.map((r: Baris) => ({
    id: r.id as string,
    nama: r.nama as string,
    kelas: (satu(satu(r.siswa_detail)?.kelas as { nama: string } | { nama: string }[] | undefined) as { nama: string } | undefined)?.nama ?? null,
    mulai: nowWIB(new Date((r.approved_at ?? r.created_at) as string)).tanggal,
  }));
  const aktif = new Set(murid.map((m) => m.id));

  const berlangsung = new Set<string>();
  const perMurid = new Map<string, Map<string, Catat>>();
  for (const b of baris) {
    const kunci = kunciKejadian(b.tanggal as string, b.kegiatan as string);
    if (b.status === 'hadir' || b.status === 'terlambat') berlangsung.add(kunci);
    if (!aktif.has(b.siswa_id)) continue;
    let m = perMurid.get(b.siswa_id);
    if (!m) perMurid.set(b.siswa_id, (m = new Map()));
    m.set(kunci, { status: b.status as StatusAbsen, detik: detikWIB(b.scanned_at as string) });
  }

  const hasil = new Map<string, HasilPoin>();
  for (const m of murid) hasil.set(m.id, hitungPoin(kejadian, perMurid.get(m.id) ?? new Map(), berlangsung, m.mulai));
  return { murid, kejadian, berlangsung, hasil };
}

async function ambilDataBulan(sb: SupabaseClient, tanggal: string, sekarang: Date): Promise<DataBulan> {
  const awal = awalBulan(tanggal);
  return ingat(`poin:${tanggal}`, 8000, async () => {
    const [muridMentah, baris, hk] = await Promise.all([
      semua((a, b) =>
        sb.from('profiles').select('id,nama,created_at,approved_at,siswa_detail(kelas:kelas_id(nama))').eq('role', 'siswa').eq('status', 'aktif').order('id').range(a, b),
      ),
      semua((a, b) =>
        sb.from('absensi').select('siswa_id,tanggal,kegiatan,status,scanned_at').gte('tanggal', awal).lte('tanggal', tanggal).order('id').range(a, b),
      ),
      daftarKegiatan(sb, awal, tanggal, sekarang),
    ]);
    const kejadian: Kejadian[] = hk.map((h) => ({
      tanggal: h.tanggal, kegiatan: h.kegiatan, buka: h.jendela.buka, tepat: h.jendela.tepat, tutup: h.jendela.tutup, selesai: h.selesai,
    }));
    return bangunDataBulan(muridMentah, baris, kejadian);
  });
}

const jendelaDari = (k: Kejadian): Jendela => ({
  kegiatan: k.kegiatan, tanggal: k.tanggal, buka: k.buka, tepat: k.tepat, tutup: k.tutup, label: LABEL_KEGIATAN[k.kegiatan],
});

const urlFoto = (tanggal: string, kegiatan: string) => `/api/siswa/foto?tanggal=${tanggal}&kegiatan=${kegiatan}`;

const namaBulan = (tanggal: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${tanggal}T12:00:00Z`));

const namaHari = (tanggal: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${tanggal}T12:00:00Z`));

/* ------------------------------------------------------------------- ringkasan */

/**
 * Semua yang dilihat siswa di berandanya. Catatan siswa itu sendiri selalu dibaca segar dari database
 * (supaya tanda "sudah absen" muncul seketika); data semua siswa untuk peringkat disimpan 8 detik di memori.
 */
export async function ambilRingkasanSiswa(
  sb: SupabaseClient,
  profil: { id: string; nama: string },
  sekarang: Date = new Date(),
): Promise<RingkasanSiswa> {
  const now = nowWIB(sekarang);
  const awal = awalBulan(now.tanggal);
  const [data, { data: milik }] = await Promise.all([
    ambilDataBulan(sb, now.tanggal, sekarang),
    sb
      .from('absensi')
      .select('tanggal,kegiatan,status,scanned_at,foto_path,metode,scanner:profiles!absensi_scanner_id_fkey(nama)')
      .eq('siswa_id', profil.id)
      .gte('tanggal', awal)
      .lte('tanggal', now.tanggal),
  ]);

  const rows: Baris[] = milik ?? [];
  const catatan = new Map<string, Catat>();
  const rowPer = new Map<string, Baris>();
  const berlangsung = new Set(data.berlangsung);
  for (const r of rows) {
    const kunci = kunciKejadian(r.tanggal, r.kegiatan);
    catatan.set(kunci, { status: r.status as StatusAbsen, detik: detikWIB(r.scanned_at) });
    rowPer.set(kunci, r);
    if (r.status === 'hadir' || r.status === 'terlambat') berlangsung.add(kunci);
  }

  // Penanda "sudah selesai" dihitung ulang dari waktu sekarang, bukan dari cache, supaya Alfa muncul tepat setelah jam tutup
  const kejadian: Kejadian[] = data.kejadian.map((k) => ({
    ...k,
    selesai: k.tanggal < now.tanggal || (k.tanggal === now.tanggal && now.detik > toMenit(k.tutup) * 60),
  }));

  const saya = data.murid.find((m) => m.id === profil.id);
  const mulai = saya?.mulai ?? now.tanggal;
  const hasil = hitungPoin(kejadian, catatan, berlangsung, mulai);

  /* ---- peringkat: data siswa lain dari cache, data siswa ini segar ---- */
  const peserta: PesertaPapan[] = data.murid
    .filter((m) => m.id !== profil.id)
    .map((m) => ({ id: m.id, nama: m.nama, kelas: m.kelas, poin: data.hasil.get(m.id)?.poin ?? 0, skor: data.hasil.get(m.id)?.skor ?? null }));
  peserta.push({ id: profil.id, nama: saya?.nama ?? profil.nama, kelas: saya?.kelas ?? null, poin: hasil.poin, skor: hasil.skor });
  const urut = urutkanPapan(peserta);
  const posisi = urut.findIndex((p) => p.id === profil.id) + 1;
  const papan: PapanItem[] = urut
    .slice(0, 3)
    .map((p, i) => ({ posisi: i + 1, nama: p.nama, kelas: p.kelas, poin: p.poin, saya: p.id === profil.id }))
    .filter((p) => p.poin > 0);

  /* ---- kegiatan hari ini ---- */
  const poinPer = new Map(hasil.rincian.map((r) => [kunciKejadian(r.tanggal, r.kegiatan), r.poin]));
  const hariIni: ItemHariIni[] = kejadian
    .filter((k) => k.tanggal === now.tanggal)
    .sort((a, b) => a.buka.localeCompare(b.buka))
    .map((k) => {
      const j = jendelaDari(k);
      const state = stateJendela(j, now);
      const kunci = kunciKejadian(k.tanggal, k.kegiatan);
      const r = rowPer.get(kunci);
      const sudah: SudahAbsen | null = r
        ? {
            status: r.status as StatusAbsen,
            statusLabel: LABEL_STATUS[r.status as StatusAbsen],
            jam: formatJamWIB(r.scanned_at),
            foto: r.foto_path ? urlFoto(k.tanggal, k.kegiatan) : null,
            pemindai: r.metode === 'qr_layar' || r.metode === 'kartu' ? (satu(r.scanner as { nama: string } | { nama: string }[] | undefined)?.nama ?? null) : null,
            keterangan: r.metode === 'izin' ? 'Izin disetujui admin' : r.metode === 'manual' ? 'Dicatat manual oleh admin' : null,
            poin: poinPer.get(kunci) ?? 0,
          }
        : null;
      return {
        kegiatan: k.kegiatan,
        label: j.label,
        buka: k.buka,
        tepat: k.tepat,
        tutup: k.tutup,
        state,
        pesan: pesanState(j, state),
        sudah,
        alfa: !r && state === 'ditutup' && berlangsung.has(kunci),
        poinJikaSekarang: r ? null : poinJikaSekarang(k.kegiatan, state, now.detik, k.buka, k.tepat, hasil.streak),
      };
    });

  /* ---- riwayat bulan ini (terbaru di atas) ---- */
  const riwayat: RiwayatItem[] = [...hasil.rincian]
    .reverse()
    .slice(0, 14)
    .map((x) => {
      const r = rowPer.get(kunciKejadian(x.tanggal, x.kegiatan));
      return {
        tanggal: x.tanggal,
        hari: namaHari(x.tanggal),
        kegiatan: x.kegiatan,
        status: x.status,
        jam: r ? formatJamWIB(r.scanned_at) : null,
        poin: x.poin,
        foto: r?.foto_path ? urlFoto(x.tanggal, x.kegiatan) : null,
      };
    });

  return {
    nama: profil.nama,
    tanggal: now.tanggal,
    tanggalLabel: formatTanggalID(now.tanggal),
    bulanLabel: namaBulan(now.tanggal),
    jam: now.jam,
    hariIni,
    poin: {
      bulan: hasil.poin,
      hariIni: hasil.rincian.filter((x) => x.tanggal === now.tanggal).reduce((s, x) => s + x.poin, 0),
      streak: hasil.streak,
      hadir: hasil.hadir,
      terlambat: hasil.terlambat,
      izinSakitHaid: hasil.izin + hasil.sakit + hasil.haid,
      alfa: hasil.alfa,
      potonganAlfa: hasil.alfa * POTONGAN_ALFA,
    },
    skor: hasil.skor,
    ketepatan: hasil.ketepatan,
    peringkat: { posisi, dari: urut.length },
    papan,
    riwayat,
    aturan: { zuhur: { ...POIN.zuhur }, wirid: { ...POIN.wirid }, bonusMaks: BONUS_BERUNTUN_MAKS, potonganAlfa: POTONGAN_ALFA },
  };
}