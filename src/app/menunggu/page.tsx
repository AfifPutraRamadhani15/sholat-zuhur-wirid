import { redirect } from 'next/navigation';
import { getSessionProfile, homeFor } from '@/lib/auth';
import LogoutButton from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function Menunggu() {
  const p = await getSessionProfile();
  if (!p) redirect('/login');
  if (p.status === 'aktif') redirect(homeFor(p.role));

  const isi = {
    menunggu: {
      judul: 'Menunggu persetujuan admin',
      teks: 'Pendaftaran kamu sudah diterima. Silakan hubungi admin atau guru pembina agar akunmu segera disetujui, lalu muat ulang halaman ini.',
    },
    ditolak: {
      judul: 'Pendaftaran ditolak',
      teks: `Admin menolak pendaftaran ini${p.reject_reason ? ` dengan alasan: ${p.reject_reason}` : ''}. Hubungi admin sekolah untuk bantuan.`,
    },
    nonaktif: {
      judul: 'Akun dinonaktifkan',
      teks: 'Akun ini sedang dinonaktifkan. Hubungi admin sekolah untuk mengaktifkannya kembali.',
    },
  }[p.status];

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="card text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-2xl">⏳</div>
        <h1 className="text-lg font-bold">{isi.judul}</h1>
        <p className="mt-2 text-sm text-slate-600">{isi.teks}</p>
        <p className="mt-3 text-xs text-slate-500">Masuk sebagai {p.nama}</p>
        <div className="mt-5 flex justify-center gap-3">
          <a href="/menunggu" className="btn-outline">
            Muat ulang
          </a>
          <LogoutButton className="btn-primary" />
        </div>
      </div>
    </div>
  );
}
