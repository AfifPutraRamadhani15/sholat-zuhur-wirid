import DashboardLive from '@/components/DashboardLive';
import { ambilSnapshot } from '@/lib/dashboard';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const awal = await ambilSnapshot(supabaseAdmin());
  return <DashboardLive awal={awal} />;
}