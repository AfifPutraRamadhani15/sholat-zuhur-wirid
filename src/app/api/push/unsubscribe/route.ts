import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const skema = z.object({ endpoint: z.string().url().max(1000) });

export async function POST(req: Request) {
  const p = await apiProfile(['siswa', 'guru', 'admin']);
  if (!p) return NextResponse.json({ ok: false }, { status: 403 });
  const body = skema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false }, { status: 400 });
  await supabaseAdmin().from('push_langganan').delete().eq('endpoint', body.data.endpoint).eq('user_id', p.id);
  return NextResponse.json({ ok: true });
}