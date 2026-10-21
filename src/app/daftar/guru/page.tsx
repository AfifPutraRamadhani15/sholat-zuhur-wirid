import Link from 'next/link';
import RegisterForm from '@/components/RegisterForm';

export default function DaftarGuru() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link href="/login" className="text-sm text-brand-700">
        &larr; Kembali
      </Link>
      <h1 className="mb-1 mt-2 text-xl font-bold">Pendaftaran Guru</h1>
      <p className="mb-5 text-sm text-slate-600">Akun guru aktif setelah disetujui admin.</p>
      <RegisterForm tipe="guru" kelas={[]} />
    </div>
  );
}
