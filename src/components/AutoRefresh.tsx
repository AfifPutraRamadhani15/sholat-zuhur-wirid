'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AutoRefresh({ detik = 10 }: { detik?: number }) {
  const r = useRouter();
  useEffect(() => {
    const t = setInterval(() => r.refresh(), detik * 1000);
    return () => clearInterval(t);
  }, [r, detik]);
  return null;
}