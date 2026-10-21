import Link from 'next/link';
import RegisterForm from '@/components/RegisterForm';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function DaftarSiswa() {
  const { data } = await supabaseAdmin().from('kelas').select('id,nama').order('nama');
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link href="/login" className="text-sm text-brand-700">
        &larr; Kembali
      </Link>
      <h1 className="mb-1 mt-2 text-xl font-bold">Pendaftaran Siswa</h1>
      <p className="mb-5 text-sm text-slate-600">Isi data dengan lengkap dan benar. Akun aktif setelah disetujui admin.</p>
      <RegisterForm tipe="siswa" kelas={(data ?? []) as { id: string; nama: string }[]} />
    </div>
  );
}
