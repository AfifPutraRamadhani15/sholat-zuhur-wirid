'use client';
import { useState } from 'react';
import Link from 'next/link';

interface Kelas {
  id: string;
  nama: string;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function RegisterForm({ tipe, kelas }: { tipe: 'siswa' | 'guru'; kelas: Kelas[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selesai, setSelesai] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/register/${tipe}`, { method: 'POST', body: new FormData(e.currentTarget) });
      const json = await res.json().catch(() => ({ ok: false, error: 'Terjadi kesalahan' }));
      if (json.ok) setSelesai(true);
      else setError(json.error || 'Pendaftaran gagal');
    } catch {
      setError('Tidak bisa terhubung ke server. Periksa koneksi internet.');
    } finally {
      setLoading(false);
    }
  }

  if (selesai) {
    return (
      <div className="card text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl">✓</div>
        <h2 className="text-lg font-bold">Pendaftaran terkirim</h2>
        <p className="mt-2 text-sm text-slate-600">
          Akun kamu sedang menunggu persetujuan admin. Setelah disetujui, kamu bisa masuk dengan email dan kata sandi yang
          tadi didaftarkan.
        </p>
        <Link href="/login" className="btn-primary mt-5">
          Ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <Field label="Nama lengkap">
        <input name="nama" className="input" required minLength={3} autoComplete="name" />
      </Field>

      {tipe === 'siswa' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="NISN">
              <input name="nisn" className="input" inputMode="numeric" required pattern="\d{8,12}" title="8 sampai 12 digit angka" />
            </Field>
            <Field label="NIS (jika ada)">
              <input name="nis" className="input" inputMode="numeric" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kelas">
              <select name="kelas_id" className="input" required defaultValue="">
                <option value="" disabled>
                  Pilih kelas
                </option>
                {kelas.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jenis kelamin">
              <select name="jenis_kelamin" className="input" required defaultValue="">
                <option value="" disabled>
                  Pilih
                </option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tempat lahir">
              <input name="tempat_lahir" className="input" required />
            </Field>
            <Field label="Tanggal lahir">
              <input name="tanggal_lahir" type="date" className="input" required />
            </Field>
          </div>
          <Field label="Alamat">
            <textarea name="alamat" className="input" rows={2} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama orang tua / wali">
              <input name="nama_wali" className="input" required />
            </Field>
            <Field label="No. HP orang tua / wali">
              <input name="no_hp_wali" className="input" inputMode="tel" required />
            </Field>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="NIP / NUPTK">
              <input name="nip_nuptk" className="input" required />
            </Field>
            <Field label="Mata pelajaran">
              <input name="mapel" className="input" required />
            </Field>
          </div>
          <Field label="Jabatan (opsional)">
            <input name="jabatan" className="input" placeholder="Contoh: Wali kelas, Pembina keagamaan" />
          </Field>
        </>
      )}

      <Field label="No. HP">
        <input name="no_hp" className="input" inputMode="tel" required autoComplete="tel" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email">
          <input name="email" type="email" className="input" required autoComplete="email" />
        </Field>
        <Field label="Kata sandi" hint="Minimal 8 karakter">
          <input name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />
        </Field>
      </div>
      <Field label="Foto profil (opsional)" hint="JPG, PNG, atau WebP, maksimal 1,5 MB">
        <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" className="input" />
      </Field>

      <button className="btn-primary w-full" disabled={loading}>
        {loading ? 'Mengirim...' : 'Daftar'}
      </button>
      <p className="text-center text-sm text-slate-600">
        Sudah punya akun?{' '}
        <Link href="/login" className="font-semibold text-brand-700">
          Masuk
        </Link>
      </p>
    </form>
  );
}
