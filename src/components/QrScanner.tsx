'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type KodeKegiatan = 'zuhur' | 'wirid';

interface Info {
  kegiatan: KodeKegiatan;
  label: string;
  buka: string;
  tepat: string;
  tutup: string;
  state: 'belum_dibuka' | 'hadir' | 'terlambat' | 'ditutup';
  pesan: string;
}

interface Hasil {
  ok: boolean;
  pesan: string;
  nama?: string;
  kelas?: string | null;
  statusLabel?: string;
  status?: string;
  jam?: string;
  foto?: string;
  kegiatan?: string;
}

interface Kamera {
  id: string;
  label: string;
}

/* ------------------------------------------------------------- suara (Web Audio) */
function nada(ctx: AudioContext, freq: number, mulai: number, durasi: number, tipe: OscillatorType = 'sine', vol = 0.25) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tipe;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + mulai);
  gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + mulai + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + mulai + durasi);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + mulai);
  osc.stop(ctx.currentTime + mulai + durasi + 0.05);
}
const bunyiSukses = (c: AudioContext) => {
  nada(c, 880, 0, 0.12);
  nada(c, 1320, 0.13, 0.2);
};
const bunyiGagal = (c: AudioContext) => {
  nada(c, 220, 0, 0.22, 'square', 0.18);
  nada(c, 170, 0.25, 0.3, 'square', 0.18);
};

const WARNA_STATE: Record<Info['state'], string> = {
  belum_dibuka: 'border-slate-200 bg-slate-50 text-slate-700',
  hadir: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  terlambat: 'border-amber-200 bg-amber-50 text-amber-800',
  ditutup: 'border-red-200 bg-red-50 text-red-800',
};

export default function QrScanner() {
  const [info, setInfo] = useState<Info[]>([]);
  const [tanggal, setTanggal] = useState('');
  const [pilih, setPilih] = useState<KodeKegiatan | ''>('');
  const [jalan, setJalan] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [error, setError] = useState('');
  const [kamera, setKamera] = useState<Kamera[]>([]);
  const [kameraId, setKameraId] = useState('');
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [riwayat, setRiwayat] = useState<Hasil[]>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const lockRef = useRef(false);
  const lastRef = useRef<{ t: string; at: number }>({ t: '', at: 0 });
  const pilihRef = useRef<KodeKegiatan | ''>('');
  pilihRef.current = pilih;

  /* jadwal hari ini */
  const muatJadwal = useCallback(async () => {
    try {
      const res = await fetch('/api/jadwal/hari-ini', { cache: 'no-store' });
      if (!res.ok) return;
      const j = await res.json();
      setInfo(j.kegiatan as Info[]);
      setTanggal(j.tanggal);
      setPilih((cur) => {
        if (cur && (j.kegiatan as Info[]).some((k) => k.kegiatan === cur)) return cur;
        const list = j.kegiatan as Info[];
        const aktif = list.find((k) => k.state === 'hadir' || k.state === 'terlambat') ?? list[0];
        return aktif ? aktif.kegiatan : '';
      });
    } catch {
      /* abaikan, coba lagi pada putaran berikutnya */
    }
  }, []);

  useEffect(() => {
    muatJadwal();
    const t = setInterval(muatJadwal, 30_000);
    return () => clearInterval(t);
  }, [muatJadwal]);

  /* berhenti saat halaman ditutup */
  useEffect(() => {
    return () => {
      const s = scannerRef.current;
      if (s) s.stop().then(() => s.clear()).catch(() => undefined);
    };
  }, []);

  function ambilFoto(): string | undefined {
    const v = document.querySelector('#reader video') as HTMLVideoElement | null;
    if (!v || !v.videoWidth) return undefined;
    const w = 480;
    const h = Math.round((v.videoHeight * w) / v.videoWidth);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(v, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.6);
  }

  async function proses(teks: string) {
    if (lockRef.current) return;
    if (lastRef.current.t === teks && Date.now() - lastRef.current.at < 6000) return;
    lockRef.current = true;
    lastRef.current = { t: teks, at: Date.now() };
    const foto = ambilFoto(); // gambar diambil tepat saat QR terbaca
    setSibuk(true);
    let h: Hasil;
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: teks, kegiatan: pilihRef.current || undefined, foto }),
      });
      const json = (await res.json()) as Hasil;
      h = { ...json, foto };
    } catch {
      h = { ok: false, pesan: 'Tidak bisa terhubung ke server. Periksa internet.', foto };
    }
    setSibuk(false);
    setHasil(h);
    setRiwayat((r) => [h, ...r].slice(0, 8));
    const ctx = audioRef.current;
    if (ctx) (h.ok ? bunyiSukses : bunyiGagal)(ctx);
    // jeda 1 detik sebelum QR berikutnya boleh dipindai
    setTimeout(() => {
      lockRef.current = false;
    }, 1000);
  }

  async function mulai(idKamera?: string) {
    setError('');
    try {
      if (!audioRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioRef.current = new AC();
      }
      await audioRef.current.resume();

      const daftar = await Html5Qrcode.getCameras();
      if (!daftar.length) {
        setError('Kamera tidak ditemukan di perangkat ini.');
        return;
      }
      setKamera(daftar.map((d) => ({ id: d.id, label: d.label || 'Kamera' })));

      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch {
          /* belum berjalan */
        }
      }
      const qr = new Html5Qrcode('reader');
      scannerRef.current = qr;
      await qr.start(
        idKamera ? idKamera : { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (w, h) => {
            const s = Math.floor(Math.min(w, h) * 0.7);
            return { width: s, height: s };
          },
        },
        (teks) => {
          void proses(teks);
        },
        () => undefined,
      );
      setJalan(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/permission|denied|NotAllowed/i.test(msg)) {
        setError('Izin kamera ditolak. Izinkan kamera di pengaturan peramban, lalu coba lagi.');
      } else if (!window.isSecureContext) {
        setError('Kamera hanya bisa dipakai lewat HTTPS. Buka lewat tautan resmi aplikasi.');
      } else {
        setError('Kamera tidak bisa dibuka: ' + msg);
      }
      setJalan(false);
    }
  }

  async function berhenti() {
    const s = scannerRef.current;
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {
        /* sudah berhenti */
      }
    }
    setJalan(false);
  }

  const aktifInfo = info.find((i) => i.kegiatan === pilih);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Kegiatan yang dipindai</h2>
          {tanggal && <span className="text-xs text-slate-500">Tanggal {tanggal}</span>}
        </div>
        {info.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Hari ini tidak ada kegiatan Zuhur maupun Wirid. Zuhur berlangsung Senin sampai Kamis, Wirid mengikuti jadwal yang diisi admin.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {info.map((i) => (
                <button
                  key={i.kegiatan}
                  onClick={() => setPilih(i.kegiatan)}
                  className={pilih === i.kegiatan ? 'btn-primary' : 'btn-outline'}
                >
                  {i.label}
                </button>
              ))}
            </div>
            {aktifInfo && (
              <p className={`mt-3 rounded-lg border px-4 py-3 text-sm ${WARNA_STATE[aktifInfo.state]}`}>{aktifInfo.pesan}</p>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div id="reader" className="mx-auto w-full max-w-md overflow-hidden rounded-xl bg-slate-900 [&_video]:w-full" style={{ minHeight: jalan ? 280 : 0 }} />
        {!jalan && (
          <div className="py-6 text-center">
            <p className="mb-4 text-sm text-slate-600">
              Tekan tombol di bawah, izinkan kamera, lalu arahkan kamera ke QR Code siswa. Foto siswa akan tertangkap otomatis saat QR terbaca.
            </p>
            <button className="btn-primary" onClick={() => mulai(kameraId || undefined)}>
              Mulai Scanner
            </button>
          </div>
        )}
        {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {jalan && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {kamera.length > 1 && (
              <select
                className="input max-w-xs"
                value={kameraId}
                onChange={(e) => {
                  setKameraId(e.target.value);
                  void mulai(e.target.value);
                }}
              >
                <option value="">Kamera otomatis</option>
                {kamera.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            )}
            <button className="btn-outline" onClick={berhenti}>
              Hentikan
            </button>
            {sibuk && <span className="text-sm text-slate-500">Memproses...</span>}
          </div>
        )}
      </div>

      {hasil && (
        <div className={`card flex items-center gap-4 border-2 ${hasil.ok ? 'border-emerald-400' : 'border-red-400'}`}>
          {hasil.foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hasil.foto} alt="Foto saat scan" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
          )}
          <div className="min-w-0">
            <div className={`text-sm font-bold ${hasil.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {hasil.ok ? 'BERHASIL' : 'DITOLAK'}
            </div>
            {hasil.nama && <div className="truncate text-lg font-bold">{hasil.nama}</div>}
            {hasil.kelas && <div className="text-sm text-slate-600">{hasil.kelas}</div>}
            <div className="text-sm">
              {hasil.ok ? `${hasil.pesan} • ${hasil.statusLabel} • ${hasil.jam} WIB` : hasil.pesan}
            </div>
          </div>
        </div>
      )}

      {riwayat.length > 0 && (
        <div className="card">
          <h3 className="mb-2 text-sm font-bold">Pemindaian terakhir</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {riwayat.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">{r.nama ?? 'QR tidak dikenali'}</span>
                <span className={`badge ${r.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {r.ok ? r.statusLabel : 'Ditolak'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
