import { NextResponse } from 'next/server';
import { getSessionProfile, homeFor } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const p = await getSessionProfile();
  if (!p) return NextResponse.json({ ok: false }, { status: 401 });
  if (new URL(req.url).searchParams.get('login') === '1') await audit(p.id, 'login', `akun:${p.role}`);
  return NextResponse.json({
    ok: true,
    role: p.role,
    status: p.status,
    home: p.status === 'aktif' ? homeFor(p.role) : '/menunggu',
  });
}
