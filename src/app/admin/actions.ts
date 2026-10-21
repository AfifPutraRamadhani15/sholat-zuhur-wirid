'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buatAkun, formKeObjek } from '@/lib/akun';
import { audit } from '@/lib/audit';
import { kirimNotif } from '@/lib/chatbot';
import { jendelaKegiatan, nowWIB, tambahHari } from '@/lib/jadwal';
import { LABEL_KEGIATAN, LABEL_STATUS, type Kegiatan, type StatusAbsen } from '@/lib/types';

type Jenis = 'msg' | 'err';

function ke(path: string, jenis: Jenis, teks: string): never {
  revalidatePath(path);
  redirect(`${path}?${jenis}=${encodeURIComponent(teks)}`);
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const TGL = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------------ akun */

export async function setujuiAkun(fd: FormData) {
  const admin = await requireRole(['admin']);
  const id = str(fd, 'id');
  const sb = supabaseAdmin();
  const { data: p } = await sb.from('profiles').select('nama,role').eq('id', id).maybeSingle();
  if (!p) ke('/admin/verifikasi', 'err', 'Akun tidak ditemukan');
  await sb
    .from('profiles')
    .update({ status: 'aktif', approved_by: admin.id, approved_at: new Date().toISOString(), reject_reason: null })
    .eq('id', id);
  await audit(admin.id, 'akun_disetujui', `akun:${p.role}`, { nama: p.nama });
  ke('/admin/verifikasi', 'msg', `Akun ${p.nama} disetujui`);
}

export async function tolakAkun(fd: FormData) {
  const admin = await requireRole(['admin']);
  const id = str(fd, 'id');
  const alasan = str(fd, 'alasan');
  if (alasan.length < 3) ke('/admin/verifikasi', 'err', 'Isi alasan penolakan');
  const sb = supabaseAdmin();
  const { data: p } = await sb.from('profiles').select('nama,role').eq('id', id).maybeSingle();
  if (!p) ke('/admin/verifikasi', 'err', 'Akun tidak ditemukan');
  await sb.from('profiles').update({ status: 'ditolak', reject_reason: alasan }).eq('id', id);
  await audit(admin.id, 'akun_ditolak', `akun:${p.role}`, { nama: p.nama, alasan });
  ke('/admin/verifikasi', 'msg', `Akun ${p.nama} ditolak`);
}

export async function ubahStatusAkun(fd: FormData) {
  const admin = await requireRole(['admin']);
  const id = str(fd, 'id');
  const status = str(fd, 'status');
  if (status !== 'aktif' && status !== 'nonaktif') ke('/admin/akun', 'err', 'Status tidak valid');
  if (id === admin.id) ke('/admin/akun', 'err', 'Kamu tidak bisa menonaktifkan akunmu sendiri');
  const sb = supabaseAdmin();
  const { data: p } = await sb.from('profiles').select('nama,role').eq('id', id).maybeSingle();
  if (!p) ke('/admin/akun', 'err', 'Akun tidak ditemukan');
  await sb.from('profiles').update({ status }).eq('id', id);
  await audit(admin.id, status === 'aktif' ? 'akun_diaktifkan' : 'akun_dinonaktifkan', `akun:${p.role}`, { nama: p.nama });
  ke('/admin/akun', 'msg', `Akun ${p.nama} ${status === 'aktif' ? 'diaktifkan' : 'dinonaktifkan'}`);
}

export async function resetPassword(fd: FormData) {
  const admin = await requireRole(['admin']);
  const id = str(fd, 'id');
  const password = String(fd.get('password') ?? '');
  if (password.length < 8) ke('/admin/akun', 'err', 'Kata sandi baru minimal 8 karakter');
  const sb = supabaseAdmin();
  const { data: p } = await sb.from('profiles').select('nama,role').eq('id', id).maybeSingle();
  if (!p) ke('/admin/akun', 'err', 'Akun tidak ditemukan');
  const { error } = await sb.auth.admin.updateUserById(id, { password });
  if (error) ke('/admin/akun', 'err', 'Gagal mengatur ulang kata sandi');
  await audit(admin.id, 'reset_password', `akun:${p.role}`, { nama: p.nama });
  ke('/admin/akun', 'msg', `Kata sandi ${p.nama} diatur ulang`);
}

export async function buatAkunManual(fd: FormData) {
  const admin = await requireRole(['admin']);
  const tipe = str(fd, 'tipe');
  if (tipe !== 'siswa' && tipe !== 'guru') ke('/admin/akun', 'err', 'Pilih jenis akun');
  const hasil = await buatAkun(tipe, formKeObjek(fd), { status: 'aktif', disetujuiOleh: admin.id });
  if (!hasil.ok) ke('/admin/akun', 'err', hasil.error);
  await audit(admin.id, 'akun_dibuat_manual', `akun:${tipe}`, { nama: str(fd, 'nama') });
  ke('/admin/akun', 'msg', `Akun ${str(fd, 'nama')} berhasil dibuat dan langsung aktif`);
}

/* ------------------------------------------------------------------ izin */

export async function tinjauIzin(fd: FormData) {
  const admin = await requireRole(['admin']);
  const id = str(fd, 'id');
  const aksi = str(fd, 'aksi');
  const catatan = str(fd, 'catatan');
  if (aksi !== 'setujui' && aksi !== 'tolak') ke('/admin/izin', 'err', 'Aksi tidak valid');
  if (aksi === 'tolak' && catatan.length < 3) ke('/admin/izin', 'err', 'Isi catatan alasan penolakan');

  const sb = supabaseAdmin();
  const { data: iz } = await sb.from('izin').select('*').eq('id', id).maybeSingle();
  if (!iz) ke('/admin/izin', 'err', 'Pengajuan tidak ditemukan');
  if (iz.status !== 'menunggu') ke('/admin/izin', 'err', 'Pengajuan ini sudah ditinjau');

  await sb
    .from('izin')
    .update({
      status: aksi === 'setujui' ? 'disetujui' : 'ditolak',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      catatan_admin: catatan || null,
    })
    .eq('id', id);

  if (aksi === 'setujui') {
    const daftar: Kegiatan[] = iz.kegiatan === 'keduanya' ? ['zuhur', 'wirid'] : [iz.kegiatan];
    for (const k of daftar) {
      const j = await jendelaKegiatan(sb, k, iz.tanggal);
      if (!j) continue; // hari itu tidak ada kegiatan tersebut
      await sb.from('absensi').upsert(
        {
          siswa_id: iz.siswa_id,
          kegiatan: k,
          tanggal: iz.tanggal,
          status: iz.jenis,
          metode: 'izin',
          scanner_id: admin.id,
          catatan: `Izin disetujui admin${catatan ? `: ${catatan}` : ''}`,
        },
        { onConflict: 'siswa_id,kegiatan,tanggal', ignoreDuplicates: true },
      );
    }
  }

  try {
    await kirimNotif(
      sb,
      iz.siswa_id,
      aksi === 'setujui'
        ? `Pengajuan ${iz.jenis} kamu untuk tanggal ${iz.tanggal} disetujui admin.`
        : `Pengajuan ${iz.jenis} kamu untuk tanggal ${iz.tanggal} ditolak. Alasan: ${catatan}`,
    );
  } catch {
    /* notifikasi opsional */
  }
  await audit(admin.id, aksi === 'setujui' ? 'izin_disetujui' : 'izin_ditolak', `izin:${id}`, { jenis: iz.jenis, tanggal: iz.tanggal });
  ke('/admin/izin', 'msg', aksi === 'setujui' ? 'Pengajuan disetujui' : 'Pengajuan ditolak');
}

/* ------------------------------------------------------------- kehadiran */

export async function absensiManual(fd: FormData) {
  const admin = await requireRole(['admin']);
  const nisn = str(fd, 'nisn');
  const kegiatan = str(fd, 'kegiatan') as Kegiatan;
  const tanggal = str(fd, 'tanggal');
  const status = str(fd, 'status') as StatusAbsen;
  const alasan = str(fd, 'alasan');
  const balik = `/admin/kehadiran`;

  if (!['zuhur', 'wirid'].includes(kegiatan)) ke(balik, 'err', 'Pilih kegiatan');
  if (!TGL.test(tanggal)) ke(balik, 'err', 'Tanggal tidak valid');
  if (!(status in LABEL_STATUS)) ke(balik, 'err', 'Pilih status');
  if (alasan.length < 3) ke(balik, 'err', 'Alasan wajib diisi untuk input manual');

  const sb = supabaseAdmin();
  const { data: sd } = await sb.from('siswa_detail').select('profile_id,jenis_kelamin,profiles:profile_id(nama,status)').eq('nisn', nisn).maybeSingle();
  if (!sd) ke(balik, 'err', 'NISN tidak ditemukan');
  const prof = Array.isArray(sd.profiles) ? sd.profiles[0] : sd.profiles;
  if (status === 'haid' && sd.jenis_kelamin !== 'P') ke(balik, 'err', 'Status Haid hanya untuk siswa perempuan');
  const j = await jendelaKegiatan(sb, kegiatan, tanggal);
  if (!j) ke(balik, 'err', `Tidak ada kegiatan ${LABEL_KEGIATAN[kegiatan]} pada tanggal itu`);

  const { error } = await sb.from('absensi').upsert(
    {
      siswa_id: sd.profile_id,
      kegiatan,
      tanggal,
      status,
      scanned_at: new Date().toISOString(),
      metode: 'manual',
      scanner_id: admin.id,
      catatan: alasan,
      foto_path: null,
    },
    { onConflict: 'siswa_id,kegiatan,tanggal' },
  );
  if (error) ke(balik, 'err', 'Gagal menyimpan absensi manual');
  await audit(admin.id, 'absensi_manual', `absensi:${nisn}`, { kegiatan, tanggal, status, alasan });
  ke(`${balik}`, 'msg', `Absensi ${prof?.nama ?? nisn} disimpan (${LABEL_STATUS[status]})`);
}

/* ------------------------------------------------------------ master data */

export async function simpanZuhur(fd: FormData) {
  const admin = await requireRole(['admin']);
  const buka = str(fd, 'buka');
  const tepat = str(fd, 'tepat');
  const tutup = str(fd, 'tutup');
  const hari = fd.getAll('hari').map(String).filter((h) => /^[1-7]$/.test(h));
  if (![buka, tepat, tutup].every((x) => HHMM.test(x))) ke('/admin/master', 'err', 'Format jam tidak valid');
  if (!(buka <= tepat && tepat <= tutup)) ke('/admin/master', 'err', 'Urutan jam harus: buka, batas tepat waktu, batas terlambat');
  if (!hari.length) ke('/admin/master', 'err', 'Pilih minimal satu hari Zuhur');
  const sb = supabaseAdmin();
  await sb.from('pengaturan').upsert([
    { key: 'zuhur_buka', value: buka },
    { key: 'zuhur_tepat', value: tepat },
    { key: 'zuhur_tutup', value: tutup },
    { key: 'zuhur_hari', value: hari.join(',') },
  ]);
  await audit(admin.id, 'pengaturan_zuhur', 'pengaturan', { buka, tepat, tutup, hari });
  ke('/admin/master', 'msg', 'Pengaturan Zuhur disimpan');
}

export async function simpanKelas(fd: FormData) {
  const admin = await requireRole(['admin']);
  const id = str(fd, 'id');
  const nama = str(fd, 'nama');
  const jurusan = str(fd, 'jurusan');
  const tingkat = str(fd, 'tingkat');
  const kelompok = str(fd, 'kelompok_penelitian');
  if (nama.length < 2) ke('/admin/master', 'err', 'Nama kelas wajib diisi');
  const baris = {
    nama,
    jurusan: jurusan || null,
    tingkat: tingkat || null,
    kelompok_penelitian: kelompok === 'eksperimen' || kelompok === 'kontrol' ? kelompok : null,
  };
  const sb = supabaseAdmin();
  const { error } = id ? await sb.from('kelas').update(baris).eq('id', id) : await sb.from('kelas').insert(baris);
  if (error) ke('/admin/master', 'err', error.code === '23505' ? 'Nama kelas sudah ada' : 'Gagal menyimpan kelas');
  await audit(admin.id, id ? 'kelas_diubah' : 'kelas_dibuat', 'kelas', baris);
  ke('/admin/master', 'msg', 'Kelas disimpan');
}

export async function hapusKelas(fd: FormData) {
  const admin = await requireRole(['admin']);
  const id = str(fd, 'id');
  const sb = supabaseAdmin();
  const { count } = await sb.from('siswa_detail').select('profile_id', { count: 'exact', head: true }).eq('kelas_id', id);
  if (count) ke('/admin/master', 'err', 'Kelas masih dipakai siswa, tidak bisa dihapus');
  await sb.from('kelas').delete().eq('id', id);
  await audit(admin.id, 'kelas_dihapus', 'kelas', { id });
  ke('/admin/master', 'msg', 'Kelas dihapus');
}

export async function simpanWirid(fd: FormData) {
  const admin = await requireRole(['admin']);
  const tanggal = str(fd, 'tanggal');
  const mulai = str(fd, 'jam_mulai');
  const tepat = str(fd, 'jam_tepat_waktu');
  const tutup = str(fd, 'jam_tutup');
  const catatan = str(fd, 'catatan');
  if (!TGL.test(tanggal)) ke('/admin/master', 'err', 'Tanggal wirid tidak valid');
  if (![mulai, tepat, tutup].every((x) => HHMM.test(x))) ke('/admin/master', 'err', 'Format jam wirid tidak valid');
  if (!(mulai <= tepat && tepat <= tutup)) ke('/admin/master', 'err', 'Urutan jam harus: mulai, batas tepat waktu, batas terlambat');
  const sb = supabaseAdmin();
  const { error } = await sb
    .from('jadwal_wirid')
    .upsert({ tanggal, jam_mulai: mulai, jam_tepat_waktu: tepat, jam_tutup: tutup, catatan: catatan || null }, { onConflict: 'tanggal' });
  if (error) ke('/admin/master', 'err', 'Gagal menyimpan jadwal wirid');
  await audit(admin.id, 'jadwal_wirid_disimpan', 'jadwal_wirid', { tanggal, mulai, tepat, tutup });
  ke('/admin/master', 'msg', 'Jadwal wirid disimpan');
}

export async function hapusWirid(fd: FormData) {
  const admin = await requireRole(['admin']);
  const id = str(fd, 'id');
  await supabaseAdmin().from('jadwal_wirid').delete().eq('id', id);
  await audit(admin.id, 'jadwal_wirid_dihapus', 'jadwal_wirid', { id });
  ke('/admin/master', 'msg', 'Jadwal wirid dihapus');
}

/** Menghapus foto bukti yang lebih lama dari N hari supaya penyimpanan gratis tidak penuh. Data absensi tetap ada. */
export async function bersihkanFoto(fd: FormData) {
  const admin = await requireRole(['admin']);
  const hari = Number(str(fd, 'hari'));
  if (!Number.isInteger(hari) || hari < 1 || hari > 365) ke('/admin/master', 'err', 'Isi jumlah hari antara 1 dan 365');
  const batas = tambahHari(nowWIB().tanggal, -hari);
  const sb = supabaseAdmin();
  let total = 0;
  for (let i = 0; i < 50; i++) {
    const { data } = await sb.from('absensi').select('id,foto_path').not('foto_path', 'is', null).lt('tanggal', batas).limit(100);
    if (!data?.length) break;
    await sb.storage.from('bukti-absensi').remove(data.map((r) => r.foto_path as string));
    await sb.from('absensi').update({ foto_path: null }).in('id', data.map((r) => r.id));
    total += data.length;
  }
  await audit(admin.id, 'foto_dibersihkan', 'bukti-absensi', { lebihDariHari: hari, jumlah: total });
  ke('/admin/master', 'msg', `${total} foto lebih lama dari ${hari} hari dihapus`);
}
