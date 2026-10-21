import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatJamWIB, formatTanggalID, kegiatanPadaTanggal, nowWIB, stateJendela, toMenit } from '@/lib/jadwal';
import { LABEL_STATUS, WARNA_STATUS, type StatusAbsen } from '@/lib/types';
import { satu } from '@/lib/util';

export default async function AdminDashboard() {
  const sb = supabaseAdmin();
  const now = nowWIB();
  const [list, siswa, akun, izin, terbaru] = await Promise.all([
    kegiatanPadaTanggal(sb, now.tanggal),
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'siswa').eq('status', 'aktif'),
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'menunggu'),
    sb.from('izin').select('id', { count: 'exact', head: true }).eq('status', 'menunggu'),
    sb
      .from('absensi')
      .select('status,kegiatan,scanned_at,metode,siswa:profiles!absensi_siswa_id_fkey(nama),scanner:profiles!absensi_scanner_id_fkey(nama)')
      .order('scanned_at', { ascending: false })
      .limit(10),
  ]);
  const totalSiswa = siswa.count ?? 0;

  const ringkas = await Promise.all(
    list.map(async (j) => {
      const { data } = await sb.from('absensi').select('status').eq('tanggal', now.tanggal).eq('kegiatan', j.kegiatan);
      const hitung: Record<StatusAbsen, number> = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, haid: 0, alfa: 0 };
      for (const r of data ?? []) hitung[r.status as StatusAbsen] += 1;
      const tercatat = (data ?? []).length;
      const selesai = now.detik > toMenit(j.tutup) * 60;
      return { j, hitung, belum: Math.max(totalSiswa - tercatat, 0), selesai, state: stateJendela(j, now) };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-600">
          {formatTanggalID(now.tanggal)} • {now.jam} WIB • {totalSiswa} siswa aktif
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/verifikasi" className="card flex items-center justify-between hover:border-brand-500">
          <span className="font-semibold">Akun menunggu persetujuan</span>
          <span className={`badge ${akun.count ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{akun.count ?? 0}</span>
        </Link>
        <Link href="/admin/izin" className="card flex items-center justify-between hover:border-brand-500">
          <span className="font-semibold">Pengajuan izin menunggu</span>
          <span className={`badge ${izin.count ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{izin.count ?? 0}</span>
        </Link>
      </div>

      {ringkas.length === 0 ? (
        <div className="card text-sm text-slate-600">Hari ini tidak ada kegiatan Zuhur maupun Wirid.</div>
      ) : (
        ringkas.map(({ j, hitung, belum, selesai }) => (
          <div key={j.kegiatan} className="card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">
                {j.label} <span className="text-sm font-normal text-slate-500">({j.buka} sampai {j.tutup} WIB)</span>
              </h2>
              <Link href={`/admin/kehadiran?kegiatan=${j.kegiatan}`} className="btn-outline btn-sm">
                Lihat detail
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
              {(Object.keys(hitung) as StatusAbsen[])
                .filter((s) => s !== 'alfa')
                .map((s) => (
                  <div key={s} className="rounded-xl bg-slate-50 p-3 text-center">
                    <div className="text-2xl font-bold">{hitung[s]}</div>
                    <span className={`badge ${WARNA_STATUS[s]}`}>{LABEL_STATUS[s]}</span>
                  </div>
                ))}
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-2xl font-bold">{hitung.alfa + (selesai ? belum : 0)}</div>
                <span className={`badge ${WARNA_STATUS.alfa}`}>Alfa</span>
              </div>
              {!selesai && (
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <div className="text-2xl font-bold">{belum}</div>
                  <span className="badge bg-slate-200 text-slate-700">Belum absen</span>
                </div>
              )}
            </div>
          </div>
        ))
      )}

      <div className="card">
        <h2 className="mb-3 font-bold">Pemindaian terbaru</h2>
        {!terbaru.data?.length ? (
          <p className="text-sm text-slate-500">Belum ada absensi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Waktu</th>
                  <th className="th">Siswa</th>
                  <th className="th">Kegiatan</th>
                  <th className="th">Status</th>
                  <th className="th">Dipindai oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {terbaru.data.map((r, i) => (
                  <tr key={i}>
                    <td className="td">{formatJamWIB(r.scanned_at)}</td>
                    <td className="td">{satu(r.siswa as { nama: string } | { nama: string }[])?.nama ?? '-'}</td>
                    <td className="td capitalize">{r.kegiatan}</td>
                    <td className="td">
                      <span className={`badge ${WARNA_STATUS[r.status as StatusAbsen]}`}>{LABEL_STATUS[r.status as StatusAbsen]}</span>
                    </td>
                    <td className="td">{satu(r.scanner as { nama: string } | { nama: string }[])?.nama ?? (r.metode === 'izin' ? 'Izin disetujui' : '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
