import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import IzinForm from '@/components/IzinForm';
import { formatTanggalID, nowWIB } from '@/lib/jadwal';
import { LABEL_KEGIATAN } from '@/lib/types';

const WARNA: Record<string, string> = {
  menunggu: 'bg-amber-100 text-amber-800',
  disetujui: 'bg-emerald-100 text-emerald-800',
  ditolak: 'bg-red-100 text-red-800',
};
const JENIS: Record<string, string> = { sakit: 'Sakit', izin: 'Izin', haid: 'Haid' };

export default async function MintaIzin() {
  const p = await requireRole(['siswa']);
  const sb = supabaseAdmin();
  const [{ data: det }, { data: daftar }] = await Promise.all([
    sb.from('siswa_detail').select('jenis_kelamin').eq('profile_id', p.id).maybeSingle(),
    sb.from('izin').select('*').eq('siswa_id', p.id).order('created_at', { ascending: false }).limit(20),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/siswa" className="text-sm text-brand-700">
          &larr; Beranda
        </Link>
        <h1 className="mt-1 text-xl font-bold">Minta Izin</h1>
        <p className="text-sm text-slate-600">Pengajuan akan diperiksa dan disetujui oleh admin.</p>
      </div>

      <IzinForm perempuan={det?.jenis_kelamin === 'P'} hariIni={nowWIB().tanggal} />

      <div className="card">
        <h2 className="mb-3 font-bold">Pengajuan saya</h2>
        {!daftar?.length ? (
          <p className="text-sm text-slate-500">Belum ada pengajuan.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {daftar.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {JENIS[r.jenis]} • {r.kegiatan === 'keduanya' ? 'Zuhur dan Wirid' : LABEL_KEGIATAN[r.kegiatan as 'zuhur' | 'wirid']}
                  </span>
                  <span className={`badge ${WARNA[r.status]}`}>{r.status}</span>
                </div>
                <div className="text-xs text-slate-500">{formatTanggalID(r.tanggal)}</div>
                <div className="mt-1 text-slate-600">{r.alasan}</div>
                {r.catatan_admin && <div className="mt-1 text-xs text-slate-500">Catatan admin: {r.catatan_admin}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
