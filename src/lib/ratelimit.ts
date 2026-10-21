// Pembatas laju sederhana di memori (per instance server). Cukup untuk skala sekolah.
const bucket = new Map<string, number[]>();

export function boleh(key: string, maks: number, jendelaMs: number): boolean {
  const now = Date.now();
  const arr = (bucket.get(key) ?? []).filter((t) => now - t < jendelaMs);
  if (arr.length >= maks) {
    bucket.set(key, arr);
    return false;
  }
  arr.push(now);
  bucket.set(key, arr);
  return true;
}

export function ipDari(req: Request): string {
  const f = req.headers.get('x-forwarded-for');
  return (f ? f.split(',')[0].trim() : req.headers.get('x-real-ip')) || 'unknown';
}
