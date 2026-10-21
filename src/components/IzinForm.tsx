'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function IzinForm({ perempuan, hariIni }: { perempuan: boolean; hariIni: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [jenis, setJenis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setOk(false);
    setLoading(true);
    try {
      const res = await fetch('/api/izin', { method: 'POST', body: new FormData(e.currentTarget) });
      const j = await res.json().catch(() => ({ ok: false, error: 'Terjadi kesalahan' }));
      if (j.ok) {
        setOk(true);
        formRef.current?.reset();
        setJenis('');
        router.refresh();
      } else {
        setError(j.error || 'Pengajuan gagal');
      }
    } catch {
      setError('Tidak bisa terhubung ke server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Pengajuan terkirim. Tunggu persetujuan admin.
        </div>
      )}
      <div>
        <label className="label">Jenis</label>
        <select name="jenis" className="input" required value={jenis} onChange={(e) => setJenis(e.target.value)}>
          <option value="" disabled>
            Pilih jenis
          </option>
          <option value="sakit">Sakit</option>
          <option value="izin">Izin</option>
          {perempuan && <option value="haid">Haid</option>}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Kegiatan</label>
          <select name="kegiatan" className="input" required defaultValue="">
            <option value="" disabled>
              Pilih kegiatan
            </option>
            <option value="zuhur">Salat Zuhur</option>
            <option value="wirid">Wirid Remaja</option>
            <option value="keduanya">Keduanya</option>
          </select>
        </div>
        <div>
          <label className="label">Tanggal</label>
          <input name="tanggal" type="date" className="input" required min={hariIni} defaultValue={hariIni} />
        </div>
      </div>
      <div>
        <label className="label">Alasan</label>
        <textarea name="alasan" className="input" rows={3} required minLength={5} maxLength={500} placeholder="Tulis alasan singkat" />
      </div>
      {jenis !== 'haid' && (
        <div>
          <label className="label">Lampiran (opsional)</label>
          <input name="lampiran" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="input" />
          <p className="mt-1 text-xs text-slate-500">Misalnya surat dokter atau surat orang tua. Maksimal 2 MB.</p>
        </div>
      )}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? 'Mengirim...' : 'Kirim pengajuan'}
      </button>
    </form>
  );
}
