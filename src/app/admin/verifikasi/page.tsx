import { supabaseAdmin } from '@/lib/supabase/admin';
import Flash from '@/components/Flash';
import { setujuiAkun, tolakAkun } from '../actions';
import { satu } from '@/lib/util';

export default async function Verifikasi({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { data } = await supabaseAdmin()
    .from('profiles')
    .select('id,role,nama,email,no_hp,created_at,siswa_detail(*,kelas:kelas_id(nama)),guru_detail(*)')
    .eq('status', 'menunggu')
    .order('created_at');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Verifikasi Akun</h1>
        <p className="text-sm text-slate-600">Periksa data pendaftar, lalu setujui atau tolak.</p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />
      {!data?.length ? (
        <div className="card text-sm text-slate-600">Tidak ada akun yang menunggu persetujuan.</div>
      ) : (
        data.map((p) => {
          const sd = satu(p.siswa_detail);
          const gd = satu(p.guru_detail);
          const kelas = satu(sd?.kelas as { nama: string } | { nama: string }[] | undefined)?.nama;
          return (
            <div key={p.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{p.nama}</span>
                    <span className="badge bg-slate-100 capitalize text-slate-700">{p.role}</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    {p.email} • {p.no_hp}
                  </div>
                </div>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {sd && (
                  <>
                    <div><dt className="inline text-slate-500">NISN: </dt><dd className="inline">{sd.nisn}</dd></div>
                    <div><dt className="inline text-slate-500">Kelas: </dt><dd className="inline">{kelas ?? '-'}</dd></div>
                    <div><dt className="inline text-slate-500">Jenis kelamin: </dt><dd className="inline">{sd.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki'}</dd></div>
                    <div><dt className="inline text-slate-500">Lahir: </dt><dd className="inline">{sd.tempat_lahir}, {sd.tanggal_lahir}</dd></div>
                    <div className="sm:col-span-2"><dt className="inline text-slate-500">Alamat: </dt><dd className="inline">{sd.alamat}</dd></div>
                    <div><dt className="inline text-slate-500">Wali: </dt><dd className="inline">{sd.nama_wali} ({sd.no_hp_wali})</dd></div>
                  </>
                )}
                {gd && (
                  <>
                    <div><dt className="inline text-slate-500">NIP/NUPTK: </dt><dd className="inline">{gd.nip_nuptk}</dd></div>
                    <div><dt className="inline text-slate-500">Mapel: </dt><dd className="inline">{gd.mapel}</dd></div>
                    <div><dt className="inline text-slate-500">Jabatan: </dt><dd className="inline">{gd.jabatan ?? '-'}</dd></div>
                  </>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                <form action={setujuiAkun}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn-primary btn-sm">Setujui</button>
                </form>
                <form action={tolakAkun} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input name="alasan" className="input w-56" placeholder="Alasan penolakan" required minLength={3} />
                  <button className="btn-danger btn-sm">Tolak</button>
                </form>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
