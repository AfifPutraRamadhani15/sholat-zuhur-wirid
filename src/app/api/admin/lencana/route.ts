import { NextResponse } from 'next/server';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ambilLencana } from '@/lib/lencana';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const p = await apiProfile(['admin']);
  if (!p) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const data = await ambilLencana(supabaseAdmin());
    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}