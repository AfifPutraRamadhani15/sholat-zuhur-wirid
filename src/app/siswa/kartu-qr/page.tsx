import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buatTokenKartu } from '@/lib/qr';
import KartuQr from '@/components/KartuQr';

export default async function KartuQrPage() {
  const p = await requireRole(['siswa']);
  const { data } = await supabaseAdmin()
    .from('siswa_detail')
    .select('nisn,kelas:kelas_id(nama)')
    .eq('profile_id', p.id)
    .maybeSingle();
  const rel = (data as { kelas?: { nama?: string } | { nama?: string }[] | null } | null)?.kelas;
  const kelas = (Array.isArray(rel) ? rel[0]?.nama : rel?.nama) ?? '-';
  return (
    <div className="space-y-4">
      <Link href="/siswa/absen" className="no-print text-sm text-brand-700">
        &larr; Kembali
      </Link>
      <h1 className="no-print text-xl font-bold">Kartu QR Saya</h1>
      <p className="no-print text-sm text-slate-600">
        Cetak kartu ini sebagai cadangan jika HP bermasalah. Kartu bisa dipindai guru mana saja, dan fotomu tetap diambil saat pemindaian.
        Jangan dipinjamkan ke teman.
      </p>
      <KartuQr token={buatTokenKartu(p.id)} nama={p.nama} kelas={kelas} nisn={data?.nisn ?? '-'} />
    </div>
  );
}
