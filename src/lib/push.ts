import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LABEL_KEGIATAN, LABEL_STATUS, type Kegiatan, type StatusAbsen } from './types';
import { kegiatanPadaTanggal, nowWIB, toMenit, type Jendela } from './jadwal';

/* ------------------------------------------------------------------ pengaturan
 * Environment Variables (lokal: .env.local, online: Vercel):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   kunci publik  (dari: npx web-push generate-vapid-keys)
 *   VAPID_PRIVATE_KEY              kunci privat  (RAHASIA)
 *   VAPID_SUBJECT                  mailto:emailanda@gmail.com
 *   PUSH_PENGINGAT_MENIT=60        pengingat dikirim sekian menit sebelum absen dibuka
 */

export function pushAktif(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

export function menitPengingat(): number {
  const n = Number(process.env.PUSH_PENGINGAT_MENIT ?? 60);
  if (!Number.isFinite(n)) return 60;
  return Math.min(240, Math.max(5, Math.round(n)));
}

export interface Langganan {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface MuatanPush {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export type KirimPush = (l: Langganan, m: MuatanPush) => Promise<void>;

let siap = false;
function siapkan() {
  if (siap) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  siap = true;
}

/** Pengirim sungguhan lewat layanan push milik peramban (Google, Apple, Mozilla). Gratis. */
export const kirimWebPush: KirimPush = async (l, m) => {
  siapkan();
  await webpush.sendNotification({ endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } }, JSON.stringify(m), {
    TTL: 60 * 60,
    urgency: 'high',
    timeout: 10000,
  });
};

/* ------------------------------------------------------------------- isi pesan */

export function muatanPengingat(j: Jendela, sisaMenit: number): MuatanPush {
  return {
    title: `${j.label} dibuka ${sisaMenit} menit lagi`,
    body: `Absen dibuka pukul ${j.buka} WIB. Tepat waktu sampai ${j.tepat}, batas terlambat ${j.tutup}. Buka aplikasi, pilih Ambil Absen, lalu tunjukkan QR ke guru.`,
    url: '/siswa/absen',
    tag: `pengingat-${j.kegiatan}-${j.tanggal}`,
  };
}

export function muatanKonfirmasi(p: { kegiatan: Kegiatan; tanggal: string; jam: string; status: StatusAbsen }): MuatanPush {
  return {
    title: `Absen ${LABEL_KEGIATAN[p.kegiatan]} tercatat`,
    body: `Pukul ${p.jam} WIB • ${LABEL_STATUS[p.status]}${p.status === 'terlambat' ? '. Besok usahakan datang lebih awal ya.' : '. Terima kasih sudah hadir tepat waktu.'}`,
    url: '/siswa',
    tag: `absen-${p.kegiatan}-${p.tanggal}`,
  };
}

export function dalamJendelaPengingat(j: Jendela, nowDetik: number, menit: number): boolean {
  const buka = toMenit(j.buka) * 60;
  return nowDetik >= buka - menit * 60 && nowDetik < buka;
}

/* ------------------------------------------------------------------ pengiriman */

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

async function paralel(tugas: (() => Promise<void>)[], batas = 10): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(batas, tugas.length) }, async () => {
      for (;;) {
        const n = i++;
        if (n >= tugas.length) return;
        await tugas[n]();
      }
    }),
  );
}

interface Tujuan {
  userId: string;
  subs: Langganan[];
  muatan: MuatanPush;
}

/** Mengirim ke semua perangkat. Mengembalikan jumlah perangkat yang berhasil per pengguna. Perangkat kedaluwarsa dihapus otomatis. */
async function kirimKeDaftar(sb: SupabaseClient, daftar: Tujuan[], kirim: KirimPush): Promise<Map<string, number>> {
  const sukses = new Map<string, number>();
  const kedaluwarsa: string[] = [];
  const tugas: (() => Promise<void>)[] = [];
  for (const d of daftar) {
    for (const l of d.subs) {
      tugas.push(async () => {
        try {
          await kirim(l, d.muatan);
          sukses.set(d.userId, (sukses.get(d.userId) ?? 0) + 1);
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) kedaluwarsa.push(l.endpoint);
        }
      });
    }
  }
  await paralel(tugas);
  if (kedaluwarsa.length) await sb.from('push_langganan').delete().in('endpoint', kedaluwarsa);
  return sukses;
}

async function langgananUser(sb: SupabaseClient, userId: string): Promise<Langganan[]> {
  const { data } = await sb.from('push_langganan').select('endpoint,p256dh,auth').eq('user_id', userId);
  return (data ?? []) as Langganan[];
}

/** Kirim satu pesan ke semua perangkat milik satu pengguna. Tidak pernah melempar error. */
export async function kirimKePengguna(sb: SupabaseClient, userId: string, muatan: MuatanPush, kirim: KirimPush = kirimWebPush): Promise<number> {
  try {
    if (!pushAktif()) return 0;
    const subs = await langgananUser(sb, userId);
    if (!subs.length) return 0;
    const hasil = await kirimKeDaftar(sb, [{ userId, subs, muatan }], kirim);
    return hasil.get(userId) ?? 0;
  } catch {
    return 0;
  }
}

export async function kirimKonfirmasiPush(
  sb: SupabaseClient,
  p: { siswaId: string; kegiatan: Kegiatan; tanggal: string; jam: string; status: StatusAbsen },
  kirim: KirimPush = kirimWebPush,
): Promise<void> {
  await kirimKePengguna(sb, p.siswaId, muatanKonfirmasi(p), kirim);
}

export interface HasilPengingat {
  kegiatan: Kegiatan;
  status: string;
  calon: number;
  terkirim: number;
  gagal: number;
}

const UKURAN_BATCH = 100;

/** Dipanggil penjadwal tiap beberapa menit. Mengirim pengingat satu kali per siswa per kegiatan. */
export async function jalankanPengingatPush(
  sb: SupabaseClient,
  sekarang: Date = new Date(),
  kirim: KirimPush = kirimWebPush,
): Promise<{ ok: boolean; hasil: HasilPengingat[]; error?: string }> {
  const now = nowWIB(sekarang);
  const menit = menitPengingat();
  const hasil: HasilPengingat[] = [];
  const list = await kegiatanPadaTanggal(sb, now.tanggal);

  for (const j of list) {
    const ringkas: HasilPengingat = { kegiatan: j.kegiatan, status: '', calon: 0, terkirim: 0, gagal: 0 };
    hasil.push(ringkas);
    if (!dalamJendelaPengingat(j, now.detik, menit)) {
      ringkas.status = 'belum atau sudah lewat waktu pengingat';
      continue;
    }
    const sisaMenit = Math.max(1, Math.ceil((toMenit(j.buka) * 60 - now.detik) / 60));
    const muatan = muatanPengingat(j, sisaMenit);

    const [siswa, absen, langganan] = await Promise.all([
      semua((a, b) => sb.from('profiles').select('id').eq('role', 'siswa').eq('status', 'aktif').order('id').range(a, b)),
      semua((a, b) => sb.from('absensi').select('siswa_id').eq('tanggal', now.tanggal).eq('kegiatan', j.kegiatan).order('id').range(a, b)),
      semua((a, b) => sb.from('push_langganan').select('user_id,endpoint,p256dh,auth').order('id').range(a, b)),
    ]);
    const sudahAbsen = new Set(absen.map((r: Baris) => r.siswa_id as string));
    const subsPer = new Map<string, Langganan[]>();
    for (const r of langganan) {
      const arr = subsPer.get(r.user_id) ?? [];
      arr.push({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth });
      subsPer.set(r.user_id, arr);
    }
    const calon = siswa
      .map((s: Baris) => s.id as string)
      .filter((id: string) => !sudahAbsen.has(id) && (subsPer.get(id)?.length ?? 0) > 0);
    ringkas.calon = calon.length;

    for (let i = 0; i < calon.length; i += UKURAN_BATCH) {
      const ids: string[] = calon.slice(i, i + UKURAN_BATCH);

      // Klaim: baris baru (belum pernah dikirim) atau baris yang sebelumnya gagal (dicoba ulang)
      const baru = await sb
        .from('push_log')
        .upsert(
          ids.map((id) => ({ siswa_id: id, jenis: 'pengingat', kegiatan: j.kegiatan, tanggal: now.tanggal, status: 'antre' })),
          { onConflict: 'siswa_id,jenis,kegiatan,tanggal', ignoreDuplicates: true },
        )
        .select('siswa_id');
      if (baru.error) {
        ringkas.status = 'gagal menulis push_log (sudah menjalankan supabase/push.sql?)';
        return { ok: false, hasil, error: ringkas.status };
      }
      const ulang = await sb
        .from('push_log')
        .update({ status: 'antre' })
        .eq('jenis', 'pengingat')
        .eq('kegiatan', j.kegiatan)
        .eq('tanggal', now.tanggal)
        .eq('status', 'gagal')
        .in('siswa_id', ids)
        .select('siswa_id');
      const diklaim = new Set<string>([...(baru.data ?? []), ...(ulang.data ?? [])].map((r: Baris) => r.siswa_id as string));
      const kirimIds = ids.filter((id) => diklaim.has(id));
      if (!kirimIds.length) continue;

      const hasilKirim = await kirimKeDaftar(
        sb,
        kirimIds.map((id) => ({ userId: id, subs: subsPer.get(id) ?? [], muatan })),
        kirim,
      );
      const berhasil = kirimIds.filter((id) => (hasilKirim.get(id) ?? 0) > 0);
      const gagalIds = kirimIds.filter((id) => (hasilKirim.get(id) ?? 0) === 0);
      const tandai = async (daftar: string[], status: 'terkirim' | 'gagal') => {
        if (!daftar.length) return;
        await sb
          .from('push_log')
          .update({ status, detail: status === 'gagal' ? 'semua perangkat gagal menerima' : null })
          .eq('jenis', 'pengingat')
          .eq('kegiatan', j.kegiatan)
          .eq('tanggal', now.tanggal)
          .in('siswa_id', daftar);
      };
      await tandai(berhasil, 'terkirim');
      await tandai(gagalIds, 'gagal');
      ringkas.terkirim += berhasil.length;
      ringkas.gagal += gagalIds.length;
    }
    if (ringkas.gagal) ringkas.status = `${ringkas.gagal} siswa gagal, akan dicoba lagi pada putaran berikutnya`;
    else ringkas.status = ringkas.terkirim ? 'pengingat dikirim' : 'tidak ada yang perlu dikirim (sudah dikirim, sudah absen, atau belum mengaktifkan notifikasi)';
  }
  return { ok: true, hasil };
}