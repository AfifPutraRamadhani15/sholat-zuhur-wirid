import Shell from '@/components/Shell';
import ChatWidget from '@/components/ChatWidget';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SiswaLayout({ children }: { children: React.ReactNode }) {
  const p = await requireRole(['siswa']);
  return (
    <Shell nama={p.nama} peran="Siswa" home="/siswa" lebar="max-w-2xl">
      {children}
      <ChatWidget userId={p.id} />
    </Shell>
  );
}
