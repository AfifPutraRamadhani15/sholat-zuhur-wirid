import { z } from 'zod';
import { supabaseAdmin } from './supabase/admin';

const teks = (min = 1, pesan = 'Wajib diisi') => z.string().trim().min(min, pesan);
const opsional = z.string().trim().optional().or(z.literal(''));
const tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid');

const dasar = {
  nama: teks(3, 'Nama lengkap minimal 3 karakter'),
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter').max(72, 'Kata sandi terlalu panjang'),
  no_hp: z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, 'Nomor HP tidak valid'),
};

export const skemaSiswa = z.object({
  ...dasar,
  nisn: z.string().trim().regex(/^\d{8,12}$/, 'NISN harus 8 sampai 12 digit angka'),
  nis: opsional,
  kelas_id: z.string().uuid('Pilih kelas'),
  jenis_kelamin: z.enum(['L', 'P'], { message: 'Pilih jenis kelamin' }),
  tempat_lahir: teks(2, 'Tempat lahir wajib diisi'),
  tanggal_lahir: tanggal,
  alamat: teks(5, 'Alamat wajib diisi'),
  nama_wali: teks(3, 'Nama wali wajib diisi'),
  no_hp_wali: z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, 'Nomor HP wali tidak valid'),
});

export const skemaGuru = z.object({
  ...dasar,
  nip_nuptk: teks(5, 'NIP atau NUPTK wajib diisi'),
  mapel: teks(2, 'Mata pelajaran wajib diisi'),
  jabatan: opsional,
});

export type TipeAkun = 'siswa' | 'guru';
export type HasilAkun = { ok: true; id: string } | { ok: false; error: string };

const FOTO_OK = ['image/jpeg', 'image/png', 'image/webp'];

function pesanZod(e: z.ZodError): string {
  return e.issues[0]?.message ?? 'Data tidak valid';
}

/** Membuat akun (auth + profil + detail). status 'aktif' dipakai saat admin membuat akun manual. */
export async function buatAkun(
  tipe: TipeAkun,
  mentah: Record<string, string>,
  opsi: { status: 'menunggu' | 'aktif'; disetujuiOleh?: string; foto?: File | null },
): Promise<HasilAkun> {
  const parsed = (tipe === 'siswa' ? skemaSiswa : skemaGuru).safeParse(mentah);
  if (!parsed.success) return { ok: false, error: pesanZod(parsed.error) };
  const d = parsed.data as Record<string, string>;
  const sb = supabaseAdmin();

  if (tipe === 'siswa') {
    const { data: dupe } = await sb.from('siswa_detail').select('profile_id').eq('nisn', d.nisn).maybeSingle();
    if (dupe) return { ok: false, error: 'NISN sudah terdaftar' };
  }

  const { data: user, error: eAuth } = await sb.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
  });
  if (eAuth || !user?.user) {
    const msg = eAuth?.message ?? '';
    if (/already|registered|exists/i.test(msg)) return { ok: false, error: 'Email sudah terdaftar' };
    return { ok: false, error: 'Gagal membuat akun, coba lagi' };
  }
  const id = user.user.id;
  const rollback = async () => {
    await sb.auth.admin.deleteUser(id);
  };

  let fotoPath: string | null = null;
  if (opsi.foto && opsi.foto.size > 0) {
    if (!FOTO_OK.includes(opsi.foto.type) || opsi.foto.size > 1_500_000) {
      await rollback();
      return { ok: false, error: 'Foto profil harus JPG, PNG, atau WebP maksimal 1,5 MB' };
    }
    const ext = opsi.foto.type === 'image/png' ? 'png' : opsi.foto.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${id}/profil.${ext}`;
    const { error: eUp } = await sb.storage
      .from('foto-profil')
      .upload(path, Buffer.from(await opsi.foto.arrayBuffer()), { contentType: opsi.foto.type, upsert: true });
    if (!eUp) fotoPath = path;
  }

  const { error: eProf } = await sb.from('profiles').insert({
    id,
    role: tipe,
    status: opsi.status,
    nama: d.nama,
    email: d.email,
    no_hp: d.no_hp,
    foto_path: fotoPath,
    approved_by: opsi.status === 'aktif' ? opsi.disetujuiOleh ?? null : null,
    approved_at: opsi.status === 'aktif' ? new Date().toISOString() : null,
  });
  if (eProf) {
    await rollback();
    return { ok: false, error: 'Gagal menyimpan profil' };
  }

  const { error: eDet } =
    tipe === 'siswa'
      ? await sb.from('siswa_detail').insert({
          profile_id: id,
          nisn: d.nisn,
          nis: d.nis || null,
          kelas_id: d.kelas_id,
          jenis_kelamin: d.jenis_kelamin,
          tempat_lahir: d.tempat_lahir,
          tanggal_lahir: d.tanggal_lahir,
          alamat: d.alamat,
          nama_wali: d.nama_wali,
          no_hp_wali: d.no_hp_wali,
        })
      : await sb.from('guru_detail').insert({
          profile_id: id,
          nip_nuptk: d.nip_nuptk,
          mapel: d.mapel,
          jabatan: d.jabatan || null,
        });
  if (eDet) {
    await rollback(); // profil ikut terhapus lewat cascade
    return { ok: false, error: 'Gagal menyimpan data detail' };
  }
  return { ok: true, id };
}

export function formKeObjek(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === 'string') o[k] = v;
  });
  return o;
}
