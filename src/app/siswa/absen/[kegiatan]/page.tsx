import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import QrDisplay from '@/components/QrDisplay';
import { LABEL_KEGIATAN } from '@/lib/types';

export default async function QrKegiatan({ params }: { params: Promise<{ kegiatan: string }> }) {
  await requireRole(['siswa']);
  const { kegiatan } = await params;
  if (kegiatan !== 'zuhur' && kegiatan !== 'wirid') notFound();
  return (
    <div className="space-y-4">
      <Link href="/siswa/absen" className="text-sm text-brand-700">
        &larr; Pilih kegiatan
      </Link>
      <QrDisplay kegiatan={kegiatan} label={LABEL_KEGIATAN[kegiatan]} />
    </div>
  );
}
