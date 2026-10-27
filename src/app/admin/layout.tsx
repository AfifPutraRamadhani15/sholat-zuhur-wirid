import Shell from '@/components/Shell';
import AdminNav, { type ItemMenu } from '@/components/AdminNav';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ambilLencana, LENCANA_KOSONG, type Lencana } from '@/lib/lencana';

export const dynamic = 'force-dynamic';

const MENU: ItemMenu[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/scan', label: 'Scanner' },
  { href: '/admin/kehadiran', label: 'Kehadiran', lencana: 'alfa' },
  { href: '/admin/verifikasi', label: 'Verifikasi Akun', lencana: 'akun' },
  { href: '/admin/akun', label: 'Kelola Akun' },
  { href: '/admin/izin', label: 'Izin', lencana: 'izin' },
  { href: '/admin/master', label: 'Master Data', lencana: 'wirid' },
  { href: '/admin/log', label: 'Log Aktivitas' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const p = await requireRole(['admin']);
  let awal: Lencana = LENCANA_KOSONG;
  try {
    awal = await ambilLencana(supabaseAdmin());
  } catch {
    /* angka akan terisi pada pembaruan berikutnya */
  }
  return (
    <Shell navNode={<AdminNav items={MENU} awal={awal} pengguna={p.id} />} nama={p.nama} peran="Admin" home="/admin" lebar="max-w-6xl">
      {children}
    </Shell>
  );
}