import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { jendelaKegiatan, nowWIB, pesanState, stateJendela } from '@/lib/jadwal';
import { LABEL_KEGIATAN, LABEL_STATUS, type Kegiatan, type StatusAbsen } from '@/lib/types';

export default async function AmbilAbsen() {
  const p = await requireRole(['siswa']);
  const sb = supabaseAdmin();
  const now = nowWIB();
  const { data: sudah } = await sb.from('absensi').select('kegiatan,status').eq('siswa_id', p.id).eq('tanggal', now.tanggal);
  const status = new Map((sudah ?? []).map((r) => [r.kegiatan as string, r.status as StatusAbsen]));

  const kartu = await Promise.all(
    (['zuhur', 'wirid'] as Kegiatan[]).map(async (k) => {
      const j = await jendelaKegiatan(sb, k, now.tanggal);
      return { k, j, pesan: j ? pesanState(j, stateJendela(j, now)) : null };
    }),
  );

  return (
    <div className="space-y-5">
      <div>
        <Link href="/siswa" className="text-sm text-brand-700">
          &larr; Beranda
        </Link>
        <h1 className="mt-1 text-xl font-bold">Ambil Absen</h1>
        <p className="text-sm text-slate-600">Pilih kegiatan, lalu tunjukkan QR yang muncul ke kamera guru mana saja.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {kartu.map(({ k, j, pesan }) => {
          const aktif = !!j;
          const isi = (
            <>
              <span className="text-3xl">{k === 'zuhur' ? '🕌' : '📿'}</span>
              <span className="text-lg font-bold">{LABEL_KEGIATAN[k]}</span>
              <span className="text-xs text-slate-500">
                {j ? pesan : k === 'zuhur' ? 'Tidak ada kegiatan hari ini (Senin sampai Kamis)' : 'Tidak ada wirid hari ini'}
              </span>
              {status.has(k) && <span className="badge bg-emerald-100 text-emerald-800">Sudah: {LABEL_STATUS[status.get(k)!]}</span>}
            </>
          );
          return aktif ? (
            <Link key={k} href={`/siswa/absen/${k}`} className="card flex flex-col items-center gap-2 py-6 text-center transition hover:border-brand-500 hover:shadow-md">
              {isi}
            </Link>
          ) : (
            <div key={k} className="card flex flex-col items-center gap-2 py-6 text-center opacity-60">
              {isi}
            </div>
          );
        })}
      </div>

      <Link href="/siswa/kartu-qr" className="btn-outline w-full">
        Cetak Kartu QR saya
      </Link>
    </div>
  );
}
