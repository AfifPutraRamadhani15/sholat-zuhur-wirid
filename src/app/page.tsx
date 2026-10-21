import { redirect } from 'next/navigation';
import { getSessionProfile, homeFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const p = await getSessionProfile();
  if (!p) redirect('/login');
  if (p.status !== 'aktif') redirect('/menunggu');
  redirect(homeFor(p.role));
}
