import Link from 'next/link';
import AktifkanNotif from '@/components/AktifkanNotif';
import DashboardSiswa from '@/components/DashboardSiswa';
import { requireRole } from '@/lib/auth';
import { ambilRingkasanSiswa } from '@/lib/ringkasan-siswa';
import { supabaseAdmin } from '@/lib/supabase/admin';
import PoinSiswa from '@/components/PoinSiswa';
import AutoRefresh from '@/components/AutoRefresh';

   export const dynamic = 'force-dynamic';
   export const revalidate = 0;

export default async function SiswaHome() {
  const p = await requireRole(['siswa']);
  const awal = await ambilRingkasanSiswa(supabaseAdmin(), p);

  return (
    <DashboardSiswa
      awal={awal}
      aksi={
        <>
          <AktifkanNotif />
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
        </>
      }
    />
  );
}