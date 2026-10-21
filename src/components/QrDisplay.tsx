'use client';
import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const LABEL: Record<string, string> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  haid: 'Haid',
  alfa: 'Alfa',
};

export default function QrDisplay({ kegiatan, label }: { kegiatan: 'zuhur' | 'wirid'; label: string }) {
  const [token, setToken] = useState('');
  const [sisa, setSisa] = useState(0);
  const [pesan, setPesan] = useState('');
  const [error, setError] = useState('');
  const [tercatat, setTercatat] = useState<{ status: string; jam: string } | null>(null);

  const muatToken = useCallback(async () => {
    try {
      const res = await fetch(`/api/qr/token?kegiatan=${kegiatan}`, { cache: 'no-store' });
      const j = await res.json();
      if (!j.ok) {
        setError(j.pesan || 'QR tidak tersedia');
        setToken('');
        return;
      }
      setError('');
      setToken(j.token);
      setPesan(j.pesan);
      setSisa(j.ttl);
    } catch {
      setError('Tidak bisa terhubung ke server. Periksa internet.');
    }
  }, [kegiatan]);

  // perbarui QR sebelum kedaluwarsa
  useEffect(() => {
    void muatToken();
    const t = setInterval(muatToken, 45_000);
    return () => clearInterval(t);
  }, [muatToken]);

  // hitung mundur tampilan
  useEffect(() => {
    const t = setInterval(() => setSisa((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  // cek apakah absen sudah dipindai guru
  useEffect(() => {
    let batal = false;
    async function cek() {
      try {
        const res = await fetch(`/api/absensi/status?kegiatan=${kegiatan}`, { cache: 'no-store' });
        const j = await res.json();
        if (!batal && j.ok && j.tercatat) setTercatat({ status: j.status, jam: j.jam });
      } catch {
        /* coba lagi */
      }
    }
    void cek();
    const t = setInterval(cek, 4000);
    return () => {
      batal = true;
      clearInterval(t);
    };
  }, [kegiatan]);

  if (tercatat) {
    return (
      <div className="card text-center">
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl">✓</div>
        <h2 className="text-lg font-bold">Absen {label} tercatat</h2>
        <p className="mt-1 text-sm text-slate-600">
          Status: <b>{LABEL[tercatat.status] ?? tercatat.status}</b> • pukul {tercatat.jam} WIB
        </p>
      </div>
    );
  }

  return (
    <div className="card text-center">
      <h2 className="font-bold">QR Absen {label}</h2>
      {error ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : token ? (
        <>
          <div className="mx-auto mt-4 w-fit rounded-2xl border border-slate-200 bg-white p-4">
            <QRCodeSVG value={token} size={240} level="M" marginSize={1} />
          </div>
          <p className="mt-3 text-sm text-slate-600">Tunjukkan QR ini ke kamera guru mana saja.</p>
          <p className="mt-1 text-xs text-slate-500">QR diperbarui otomatis. Berlaku {sisa} detik lagi.</p>
          {pesan && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{pesan}</p>}
          <button className="btn-outline btn-sm mt-3" onClick={() => void muatToken()}>
            Muat ulang QR
          </button>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Memuat QR...</p>
      )}
    </div>
  );
}
