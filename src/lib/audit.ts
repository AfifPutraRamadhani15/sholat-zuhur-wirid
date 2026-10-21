import { supabaseAdmin } from './supabase/admin';

export async function audit(
  actorId: string | null,
  aksi: string,
  objek: string,
  detail?: Record<string, unknown>,
) {
  try {
    await supabaseAdmin().from('audit_log').insert({
      actor_id: actorId,
      aksi,
      objek,
      detail: detail ?? null,
    });
  } catch {
    // pencatatan log tidak boleh menggagalkan proses utama
  }
}
