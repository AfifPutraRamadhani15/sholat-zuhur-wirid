import { supabaseAdmin } from '@/lib/supabase/admin';
import Flash from '@/components/Flash';
import { buatAkunManual, resetPassword, ubahStatusAkun } from '../actions';
import { satu } from '@/lib/util';

const WARNA: Record<string, string> = {
  aktif: 'bg-emerald-100 text-emerald-800',
  menunggu: 'bg-amber-100 text-amber-800',
  ditolak: 'bg-red-100 text-red-800',
  nonaktif: 'bg-slate-200 text-slate-700',
};

export default async function Akun({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sb = supabaseAdmin();
  let q = sb
    .from('profiles')
    .select('id,role,status,nama,email,no_hp,siswa_detail(nisn,kelas:kelas_id(nama)),guru_detail(nip_nuptk,mapel)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (sp.role === 'siswa' || sp.role === 'guru' || sp.role === 'admin') q = q.eq('role', sp.role);
  if (sp.status) q = q.eq('status', sp.status);
  if (sp.q) {
    const bersih = sp.q.replace(/[%,()]/g, '');
    q = q.or(`nama.ilike.%${bersih}%,email.ilike.%${bersih}%`);
  }
  const [{ data }, { data: kelas }] = await Promise.all([q, sb.from('kelas').select('id,nama').order('nama')]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Kelola Akun</h1>
        <p className="text-sm text-slate-600">Buat akun manual, aktifkan atau nonaktifkan, dan atur ulang kata sandi.</p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      <details className="card">
        <summary className="cursor-pointer font-bold">+ Buat akun manual</summary>
        <form action={buatAkunManual} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Jenis akun</label>
              <select name="tipe" className="input" required defaultValue="">
                <option value="" disabled>Pilih</option>
                <option value="siswa">Siswa</option>
                <option value="guru">Guru</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Nama lengkap</label>
              <input name="nama" className="input" required minLength={3} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="label">Email</label><input name="email" type="email" className="input" required /></div>
            <div><label className="label">Kata sandi</label><input name="password" type="text" className="input" required minLength={8} /></div>
            <div><label className="label">No. HP</label><input name="no_hp" className="input" required /></div>
          </div>
          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-2 text-sm font-semibold">Khusus siswa</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label">NISN</label><input name="nisn" className="input" /></div>
              <div><label className="label">NIS</label><input name="nis" className="input" /></div>
              <div>
                <label className="label">Kelas</label>
                <select name="kelas_id" className="input" defaultValue="">
                  <option value="">Pilih kelas</option>
                  {kelas?.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Jenis kelamin</label>
                <select name="jenis_kelamin" className="input" defaultValue="">
                  <option value="">Pilih</option><option value="L">Laki-laki</option><option value="P">Perempuan</option>
                </select>
              </div>
              <div><label className="label">Tempat lahir</label><input name="tempat_lahir" className="input" /></div>
              <div><label className="label">Tanggal lahir</label><input name="tanggal_lahir" type="date" className="input" /></div>
              <div className="sm:col-span-3"><label className="label">Alamat</label><input name="alamat" className="input" /></div>
              <div><label className="label">Nama wali</label><input name="nama_wali" className="input" /></div>
              <div><label className="label">No. HP wali</label><input name="no_hp_wali" className="input" /></div>
            </div>
          </fieldset>
          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-2 text-sm font-semibold">Khusus guru</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label">NIP / NUPTK</label><input name="nip_nuptk" className="input" /></div>
              <div><label className="label">Mata pelajaran</label><input name="mapel" className="input" /></div>
              <div><label className="label">Jabatan</label><input name="jabatan" className="input" /></div>
            </div>
          </fieldset>
          <button className="btn-primary">Buat akun (langsung aktif)</button>
        </form>
      </details>

      <form className="card flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label">Cari</label>
          <input name="q" defaultValue={sp.q ?? ''} className="input" placeholder="Nama atau email" />
        </div>
        <div>
          <label className="label">Peran</label>
          <select name="role" defaultValue={sp.role ?? ''} className="input">
            <option value="">Semua</option><option value="siswa">Siswa</option><option value="guru">Guru</option><option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={sp.status ?? ''} className="input">
            <option value="">Semua</option><option value="aktif">Aktif</option><option value="menunggu">Menunggu</option><option value="ditolak">Ditolak</option><option value="nonaktif">Nonaktif</option>
          </select>
        </div>
        <button className="btn-outline">Terapkan</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr><th className="th">Nama</th><th className="th">Peran</th><th className="th">Data</th><th className="th">Status</th><th className="th">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.map((p) => {
              const sd = satu(p.siswa_detail);
              const gd = satu(p.guru_detail);
              const kls = satu(sd?.kelas as { nama: string } | { nama: string }[] | undefined)?.nama;
              return (
                <tr key={p.id}>
                  <td className="td"><div className="font-semibold">{p.nama}</div><div className="text-xs text-slate-500">{p.email}</div></td>
                  <td className="td capitalize">{p.role}</td>
                  <td className="td text-xs text-slate-600">
                    {sd && <>NISN {sd.nisn}<br />{kls}</>}
                    {gd && <>{gd.nip_nuptk}<br />{gd.mapel}</>}
                  </td>
                  <td className="td"><span className={`badge ${WARNA[p.status]}`}>{p.status}</span></td>
                  <td className="td">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.status === 'aktif' && p.role !== 'admin' && (
                        <form action={ubahStatusAkun}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="nonaktif" /><button className="btn-outline btn-sm">Nonaktifkan</button></form>
                      )}
                      {(p.status === 'nonaktif' || p.status === 'ditolak') && (
                        <form action={ubahStatusAkun}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="aktif" /><button className="btn-primary btn-sm">Aktifkan</button></form>
                      )}
                      <form action={resetPassword} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={p.id} />
                        <input name="password" type="text" className="input w-32 py-1 text-xs" placeholder="Sandi baru" minLength={8} required />
                        <button className="btn-outline btn-sm">Reset</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data?.length && <p className="p-4 text-sm text-slate-500">Tidak ada akun yang cocok.</p>}
      </div>
    </div>
  );
}
