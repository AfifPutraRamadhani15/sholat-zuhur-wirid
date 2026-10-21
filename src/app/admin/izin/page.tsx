import { supabaseAdmin } from '@/lib/supabase/admin';
import Flash from '@/components/Flash';
import { tinjauIzin } from '../actions';
import { formatTanggalID } from '@/lib/jadwal';
import { satu } from '@/lib/util';
import { LABEL_KEGIATAN } from '@/lib/types';

const WARNA: Record<string, string> = {
  menunggu: 'bg-amber-100 text-amber-800',
  disetujui: 'bg-emerald-100 text-emerald-800',
  ditolak: 'bg-red-100 text-red-800',
};
const JENIS: Record<string, string> = { sakit: 'Sakit', izin: 'Izin', haid: 'Haid' };

export default async function IzinAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filter = sp.status === 'disetujui' || sp.status === 'ditolak' || sp.status === 'semua' ? sp.status : 'menunggu';
  const sb = supabaseAdmin();
  let q = sb
    .from('izin')
    .select('*,siswa:profiles!izin_siswa_id_fkey(nama,siswa_detail(nisn,kelas:kelas_id(nama)))')
    .order('created_at', { ascending: false })
    .limit(100);
  if (filter !== 'semua') q = q.eq('status', filter);
  const { data } = await q;

  // tautan lampiran bertanda tangan
  const paths = (data ?? []).map((r) => r.lampiran_path).filter(Boolean) as string[];
  const url = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await sb.storage.from('lampiran-izin').createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) url.set(s.path, s.signedUrl);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Pengajuan Izin</h1>
        <p className="text-sm text-slate-600">Jika disetujui, status kehadiran siswa pada tanggal itu otomatis menjadi Izin, Sakit, atau Haid.</p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />
      <div className="flex flex-wrap gap-2">
        {['menunggu', 'disetujui', 'ditolak', 'semua'].map((s) => (
          <a key={s} href={`/admin/izin?status=${s}`} className={filter === s ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}>
            {s[0].toUpperCase() + s.slice(1)}
          </a>
        ))}
      </div>

      {!data?.length ? (
        <div className="card text-sm text-slate-600">Tidak ada pengajuan.</div>
      ) : (
        data.map((r) => {
          const s = satu(r.siswa as { nama: string; siswa_detail: unknown } | { nama: string; siswa_detail: unknown }[]);
          const sd = satu(s?.siswa_detail as { nisn: string; kelas: unknown } | { nisn: string; kelas: unknown }[] | undefined);
          const kls = satu(sd?.kelas as { nama: string } | { nama: string }[] | undefined)?.nama;
          return (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold">{s?.nama ?? '-'}</div>
                  <div className="text-sm text-slate-600">
                    NISN {sd?.nisn ?? '-'} • {kls ?? '-'}
                  </div>
                </div>
                <span className={`badge ${WARNA[r.status]}`}>{r.status}</span>
              </div>
              <div className="mt-2 text-sm">
                <b>{JENIS[r.jenis]}</b> • {r.kegiatan === 'keduanya' ? 'Zuhur dan Wirid' : LABEL_KEGIATAN[r.kegiatan as 'zuhur' | 'wirid']} • {formatTanggalID(r.tanggal)}
              </div>
              <p className="mt-1 text-sm text-slate-700">{r.alasan}</p>
              {r.lampiran_path && url.get(r.lampiran_path) && (
                <a href={url.get(r.lampiran_path)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-semibold text-brand-700">
                  Lihat lampiran
                </a>
              )}
              {r.catatan_admin && <p className="mt-1 text-xs text-slate-500">Catatan admin: {r.catatan_admin}</p>}
              {r.status === 'menunggu' && (
                <form action={tinjauIzin} className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="catatan" className="input w-64" placeholder="Catatan (wajib jika menolak)" />
                  <button name="aksi" value="setujui" className="btn-primary btn-sm">Setujui</button>
                  <button name="aksi" value="tolak" className="btn-danger btn-sm">Tolak</button>
                </form>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
