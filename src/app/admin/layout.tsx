import Shell from '@/components/Shell';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/scan', label: 'Scanner' },
  { href: '/admin/kehadiran', label: 'Kehadiran' },
  { href: '/admin/verifikasi', label: 'Verifikasi Akun' },
  { href: '/admin/akun', label: 'Kelola Akun' },
  { href: '/admin/izin', label: 'Izin' },
  { href: '/admin/master', label: 'Master Data' },
  { href: '/admin/log', label: 'Log Aktivitas' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const p = await requireRole(['admin']);
  return (
    <Shell nav={NAV} nama={p.nama} peran="Admin" home="/admin" lebar="max-w-6xl">
      {children}
    </Shell>
  );
}
