'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

type KodeKegiatan = 'zuhur' | 'wirid';

/* ------------------------------------------------------------------ pengaturan */
/** Jeda minimal antar pemindaian (milidetik). 0 = tanpa jeda sama sekali. */
const JEDA_MS = 0;
/** Kartu yang sama tidak dikirim ulang selama sekian milidetik (supaya kartu yang masih di depan kamera tidak diproses berkali-kali). */
const ULANG_MS = 6000;
const BATAS_RIWAYAT = 14;

interface Info {
  kegiatan: KodeKegiatan;
  label: string;
  buka: string;
  tepat: string;
  tutup: string;
  state: 'belum_dibuka' | 'hadir' | 'terlambat' | 'ditutup';
  pesan: string;
}

interface Item {
  id: number;
  proses: boolean;
  ok?: boolean;
  pesan: string;
  nama?: string;
  kelas?: string | null;
  statusLabel?: string;
  jam?: string;
  foto?: string;
  ms?: number;
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
  gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + mulai + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + mulai + durasi);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + mulai);
  osc.stop(ctx.currentTime + mulai + durasi + 0.05);
}
/** Bunyi pendek seketika saat QR terbaca, sebelum server menjawab. */
const bunyiBaca = (c: AudioContext) => nada(c, 1500, 0, 0.05, 'square', 0.1);
const bunyiSukses = (c: AudioContext) => {
  nada(c, 988, 0, 0.09);
  nada(c, 1319, 0.09, 0.15);
};
const bunyiGagal = (c: AudioContext) => {
  nada(c, 220, 0, 0.2, 'square', 0.18);
  nada(c, 170, 0.22, 0.28, 'square', 0.18);
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
  const [error, setError] = useState('');
  const [kamera, setKamera] = useState<Kamera[]>([]);
  const [kameraId, setKameraId] = useState('');
  const [daftar, setDaftar] = useState<Item[]>([]);
  const [berhasil, setBerhasil] = useState(0);
  const [ditolak, setDitolak] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const terlihatRef = useRef<Map<string, number>>(new Map());
  const terimaRef = useRef(0);
  const urutRef = useRef(0);
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
    void muatJadwal();
    const t = setInterval(() => void muatJadwal(), 30_000);
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
    return c.toDataURL('image/jpeg', 0.55);
  }

  /** Mengirim satu pemindaian. Tidak ada kunci: banyak kartu bisa dikirim bersamaan tanpa saling menunggu. */
  async function kirim(id: number, teks: string, foto: string | undefined) {
    const ctrl = new AbortController();
    const batas = setTimeout(() => ctrl.abort(), 12000);
    let hasil: Partial<Item> & { ok: boolean; pesan: string };
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: teks, kegiatan: pilihRef.current || undefined, foto }),
        signal: ctrl.signal,
      });
      hasil = (await res.json()) as Partial<Item> & { ok: boolean; pesan: string };
    } catch {
      hasil = { ok: false, pesan: 'Tidak bisa terhubung ke server. Periksa internet, lalu pindai ulang kartunya.' };
      terlihatRef.current.delete(teks); // kegagalan jaringan: kartu boleh langsung dipindai ulang
    } finally {
      clearTimeout(batas);
    }
    setDaftar((d) => d.map((x) => (x.id === id ? { ...x, ...hasil, proses: false } : x)));
    if (hasil.ok) setBerhasil((n) => n + 1);
    else setDitolak((n) => n + 1);
    const ctx = audioRef.current;
    if (ctx) (hasil.ok ? bunyiSukses : bunyiGagal)(ctx);
    if (typeof navigator.vibrate === 'function') navigator.vibrate(hasil.ok ? 40 : [80, 40, 80]);
  }

  function proses(teks: string) {
    const t = Date.now();
    if (JEDA_MS > 0 && t - terimaRef.current < JEDA_MS) return;
    const lihat = terlihatRef.current;
    const terakhir = lihat.get(teks);
    if (terakhir !== undefined && t - terakhir < ULANG_MS) return;
    lihat.set(teks, t);
    terimaRef.current = t;
    if (lihat.size > 300) for (const [k, v] of lihat) if (t - v > ULANG_MS) lihat.delete(k);

    const foto = ambilFoto(); // gambar diambil tepat saat QR terbaca
    const ctx = audioRef.current;
    if (ctx) bunyiBaca(ctx); // umpan balik seketika, tanpa menunggu server
    const id = ++urutRef.current;
    setDaftar((d) => [{ id, proses: true, pesan: 'Memproses...', foto }, ...d].slice(0, BATAS_RIWAYAT));
    void kirim(id, teks, foto);
  }

  async function mulai(idKamera?: string) {
    setError('');
    try {
      if (!audioRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioRef.current = new AC();
      }
      await audioRef.current.resume();

      const cams = await Html5Qrcode.getCameras();
      if (!cams.length) {
        setError('Kamera tidak ditemukan di perangkat ini.');
        return;
      }
      setKamera(cams.map((d) => ({ id: d.id, label: d.label || 'Kamera' })));

      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch {
          /* belum berjalan */
        }
      }
      // Hanya mencari QR Code, dan memakai pembaca bawaan peramban bila tersedia (jauh lebih cepat dan hemat baterai)
      const qr = new Html5Qrcode('reader', {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      scannerRef.current = qr;
      await qr.start(
        idKamera ? idKamera : { facingMode: 'environment' },
        {
          fps: 15,
          disableFlip: true,
          qrbox: (w, h) => {
            const s = Math.floor(Math.min(w, h) * 0.75);
            return { width: s, height: s };
          },
        },
        (teks) => proses(teks),
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
  const terbaru = daftar[0];
  const sedangProses = daftar.filter((d) => d.proses).length;

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
                <button key={i.kegiatan} onClick={() => setPilih(i.kegiatan)} className={pilih === i.kegiatan ? 'btn-primary' : 'btn-outline'}>
                  {i.label}
                </button>
              ))}
            </div>
            {aktifInfo && <p className={`mt-3 rounded-lg border px-4 py-3 text-sm ${WARNA_STATE[aktifInfo.state]}`}>{aktifInfo.pesan}</p>}
          </>
        )}
      </div>

      <div className="card">
        <div id="reader" className="mx-auto w-full max-w-md overflow-hidden rounded-xl bg-slate-900 [&_video]:w-full" style={{ minHeight: jalan ? 280 : 0 }} />
        {!jalan && (
          <div className="py-6 text-center">
            <p className="mb-4 text-sm text-slate-600">
              Tekan tombol di bawah, izinkan kamera, lalu arahkan kamera ke QR Code siswa. Pemindaian berjalan terus tanpa jeda, jadi kartu berikutnya bisa langsung ditunjukkan.
            </p>
            <button className="btn-primary" onClick={() => void mulai(kameraId || undefined)}>
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
            <button className="btn-outline" onClick={() => void berhenti()}>
              Hentikan
            </button>
            <span className="ml-auto flex items-center gap-3 text-sm">
              <span className="badge bg-emerald-100 text-emerald-800">Berhasil {berhasil}</span>
              {ditolak > 0 && <span className="badge bg-red-100 text-red-800">Ditolak {ditolak}</span>}
              {sedangProses > 0 && <span className="text-slate-500">{sedangProses} diproses</span>}
            </span>
          </div>
        )}
      </div>

      {terbaru && (
        <div
          className={`card flex items-center gap-4 border-2 ${terbaru.proses ? 'border-slate-300' : terbaru.ok ? 'border-emerald-400' : 'border-red-400'}`}
        >
          {terbaru.foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={terbaru.foto} alt="Foto saat scan" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
          )}
          <div className="min-w-0">
            <div className={`text-sm font-bold ${terbaru.proses ? 'text-slate-500' : terbaru.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {terbaru.proses ? 'MEMPROSES...' : terbaru.ok ? 'BERHASIL' : 'DITOLAK'}
            </div>
            {terbaru.nama && <div className="truncate text-lg font-bold">{terbaru.nama}</div>}
            {terbaru.kelas && <div className="text-sm text-slate-600">{terbaru.kelas}</div>}
            <div className="text-sm">
              {terbaru.proses ? 'Menunggu konfirmasi server' : terbaru.ok ? `${terbaru.pesan} • ${terbaru.statusLabel} • ${terbaru.jam} WIB` : terbaru.pesan}
            </div>
          </div>
        </div>
      )}

      {daftar.length > 1 && (
        <div className="card">
          <h3 className="mb-2 text-sm font-bold">Pemindaian terakhir</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {daftar.slice(1).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">{r.nama ?? (r.proses ? 'Memproses...' : r.pesan)}</span>
                <span className={`badge shrink-0 ${r.proses ? 'bg-slate-100 text-slate-600' : r.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {r.proses ? '...' : r.ok ? r.statusLabel : 'Ditolak'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}