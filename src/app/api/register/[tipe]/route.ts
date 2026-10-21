import { NextResponse } from 'next/server';
import { buatAkun, formKeObjek } from '@/lib/akun';
import { boleh, ipDari } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ tipe: string }> }) {
  const { tipe } = await ctx.params;
  if (tipe !== 'siswa' && tipe !== 'guru') return NextResponse.json({ ok: false, error: 'Tidak ditemukan' }, { status: 404 });
  if (!boleh(`reg:${ipDari(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: 'Terlalu banyak percobaan, coba lagi nanti' }, { status: 429 });
  }
  const fd = await req.formData();
  const foto = fd.get('foto');
  const hasil = await buatAkun(tipe, formKeObjek(fd), {
    status: 'menunggu',
    foto: foto instanceof File ? foto : null,
  });
  if (!hasil.ok) return NextResponse.json(hasil, { status: 400 });
  await audit(hasil.id, 'registrasi', `akun:${tipe}`, { tipe });
  return NextResponse.json({ ok: true });
}
