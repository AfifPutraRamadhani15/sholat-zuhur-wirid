import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { jawabChat } from '@/lib/chatbot';
import { boleh } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const p = await apiProfile(['siswa']);
  if (!p) return NextResponse.json({ ok: false }, { status: 403 });
  const after = new URL(req.url).searchParams.get('after');
  let q = supabaseAdmin().from('chat_messages').select('id,role,tipe,isi,created_at').eq('siswa_id', p.id);
  if (after) q = q.gt('created_at', after).order('created_at', { ascending: true }).limit(50);
  else q = q.order('created_at', { ascending: false }).limit(40);
  const { data } = await q;
  const rows = after ? data ?? [] : (data ?? []).reverse();
  return NextResponse.json({ ok: true, pesan: rows });
}

const skema = z.object({ pesan: z.string().trim().min(1).max(300) });

export async function POST(req: Request) {
  const p = await apiProfile(['siswa']);
  if (!p) return NextResponse.json({ ok: false, error: 'Sesi habis' }, { status: 403 });
  if (!boleh(`chat:${p.id}`, 8, 60_000)) {
    return NextResponse.json({ ok: false, error: 'Terlalu cepat. Tunggu sebentar lalu tanya lagi.' }, { status: 429 });
  }
  const body = skema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: 'Pesan kosong atau terlalu panjang' }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: u } = await sb
    .from('chat_messages')
    .insert({ siswa_id: p.id, role: 'user', tipe: 'ai', isi: body.data.pesan })
    .select('id,role,tipe,isi,created_at')
    .single();
  const jawaban = await jawabChat(sb, p, body.data.pesan);
  const { data: b } = await sb
    .from('chat_messages')
    .insert({ siswa_id: p.id, role: 'bot', tipe: 'ai', isi: jawaban })
    .select('id,role,tipe,isi,created_at')
    .single();
  return NextResponse.json({ ok: true, pesan: [u, b].filter(Boolean) });
}
