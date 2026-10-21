import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatJamWIB, nowWIB, TZ } from '@/lib/jadwal';
import { satu } from '@/lib/util';

export default async function LogAktivitas() {
  const { data } = await supabaseAdmin()
    .from('audit_log')
    .select('id,aksi,objek,detail,created_at,actor:profiles!audit_log_actor_id_fkey(nama,role)')
    .order('created_at', { ascending: false })
    .limit(200);
  const tgl = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
  void nowWIB;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Log Aktivitas</h1>
        <p className="text-sm text-slate-600">200 aktivitas terbaru: login, registrasi, pemindaian, izin, dan perubahan data.</p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr><th className="th">Waktu</th><th className="th">Pelaku</th><th className="th">Aksi</th><th className="th">Objek</th><th className="th">Detail</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.map((r) => {
              const a = satu(r.actor as { nama: string; role: string } | { nama: string; role: string }[]);
              return (
                <tr key={r.id}>
                  <td className="td whitespace-nowrap text-xs">{tgl(r.created_at)}<br />{formatJamWIB(r.created_at)}</td>
                  <td className="td">{a ? `${a.nama} (${a.role})` : 'Sistem / pendaftar'}</td>
                  <td className="td font-semibold">{r.aksi}</td>
                  <td className="td text-xs text-slate-600">{r.objek}</td>
                  <td className="td max-w-xs truncate text-xs text-slate-500" title={r.detail ? JSON.stringify(r.detail) : ''}>
                    {r.detail ? JSON.stringify(r.detail) : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data?.length && <p className="p-4 text-sm text-slate-500">Belum ada aktivitas.</p>}
      </div>
    </div>
  );
}
