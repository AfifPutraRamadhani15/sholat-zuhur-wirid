import Shell from '@/components/Shell';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function GuruLayout({ children }: { children: React.ReactNode }) {
  const p = await requireRole(['guru']);
  return (
    <Shell nama={p.nama} peran="Guru" home="/guru" lebar="max-w-2xl">
      {children}
    </Shell>
  );
}
