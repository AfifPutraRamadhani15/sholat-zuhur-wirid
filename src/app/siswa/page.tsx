import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatTanggalID, kegiatanPadaTanggal, nowWIB } from '@/lib/jadwal';
import { LABEL_STATUS, type StatusAbsen } from '@/lib/types';

export default async function SiswaHome() {
  const p = await requireRole(['siswa']);
  const sb = supabaseAdmin();
  const now = nowWIB();
  const [list, { data: hariIni }] = await Promise.all([
    kegiatanPadaTanggal(sb, now.tanggal),
    sb.from('absensi').select('kegiatan,status').eq('siswa_id', p.id).eq('tanggal', now.tanggal),
  ]);
  const status = new Map((hariIni ?? []).map((r) => [r.kegiatan as string, r.status as StatusAbsen]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Halo, {p.nama.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600">{formatTanggalID(now.tanggal)}</p>
      </div>

      {list.length > 0 ? (
        <div className="card space-y-2 text-sm">
          <div className="font-semibold">Kegiatan hari ini</div>
          {list.map((j) => (
            <div key={j.kegiatan} className="flex items-center justify-between gap-2">
              <span>
                {j.label} <span className="text-slate-500">({j.buka} sampai {j.tutup} WIB)</span>
              </span>
              <span className="badge bg-slate-100 text-slate-700">
                {status.has(j.kegiatan) ? LABEL_STATUS[status.get(j.kegiatan)!] : 'Belum absen'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-sm text-slate-600">Hari ini tidak ada kegiatan Zuhur maupun Wirid.</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/siswa/absen" className="card flex flex-col items-center gap-2 py-8 text-center transition hover:border-brand-500 hover:shadow-md">
          <span className="text-4xl">📷</span>
          <span className="text-lg font-bold">Ambil Absen</span>
          <span className="text-sm text-slate-500">Tampilkan QR untuk dipindai guru</span>
        </Link>
        <Link href="/siswa/izin" className="card flex flex-col items-center gap-2 py-8 text-center transition hover:border-brand-500 hover:shadow-md">
          <span className="text-4xl">📝</span>
          <span className="text-lg font-bold">Minta Izin</span>
          <span className="text-sm text-slate-500">Sakit, izin, atau haid</span>
        </Link>
      </div>
    </div>
  );
}
