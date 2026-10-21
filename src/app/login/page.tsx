'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError('Email atau kata sandi salah');
        return;
      }
      const res = await fetch('/api/me?login=1');
      const json = await res.json();
      router.replace(json.home || '/');
      router.refresh();
    } catch {
      setError('Tidak bisa terhubung ke server. Periksa koneksi internet.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-700 text-xl font-bold text-white">AZ</div>
        <h1 className="text-xl font-bold text-brand-900">Absensi Salat Zuhur dan Wirid Remaja</h1>
        <p className="text-sm text-slate-600">SMKN 1 Ranah Ampek Hulu Tapan</p>
      </div>
      <form onSubmit={onSubmit} className="card space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Kata sandi</label>
          <input
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Memeriksa...' : 'Masuk'}
        </button>
        <p className="text-center text-xs text-slate-500">Lupa kata sandi? Minta admin sekolah untuk mengatur ulang.</p>
      </form>
      <div className="mt-5 grid grid-cols-2 gap-3 text-center text-sm">
        <Link href="/daftar/siswa" className="btn-outline">
          Daftar siswa
        </Link>
        <Link href="/daftar/guru" className="btn-outline">
          Daftar guru
        </Link>
      </div>
    </div>
  );
}
