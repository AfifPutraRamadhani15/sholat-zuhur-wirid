import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { boleh } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const skema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

export async function POST(req: Request) {
  const p = await apiProfile(['siswa', 'guru', 'admin']);
  if (!p) return NextResponse.json({ ok: false, error: 'Sesi habis, silakan masuk lagi' }, { status: 403 });
  if (!boleh(`push:${p.id}`, 30, 60 * 60 * 1000)) return NextResponse.json({ ok: false, error: 'Terlalu banyak percobaan' }, { status: 429 });

  const body = skema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: 'Data langganan tidak valid' }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from('push_langganan')
    .upsert(
      {
        user_id: p.id,
        endpoint: body.data.endpoint,
        p256dh: body.data.keys.p256dh,
        auth: body.data.keys.auth,
        user_agent: (req.headers.get('user-agent') ?? '').slice(0, 250),
      },
      { onConflict: 'endpoint' },
    );
  if (error) return NextResponse.json({ ok: false, error: 'Gagal menyimpan (sudah menjalankan supabase/push.sql?)' }, { status: 500 });
  return NextResponse.json({ ok: true });
}