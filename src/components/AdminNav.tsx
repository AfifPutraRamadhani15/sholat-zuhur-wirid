'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Lencana } from '@/lib/lencana';
import { bacaDilihat, jumlahBaru, rapikanDilihat, simpanDilihat, tandaiDilihat, type Dilihat } from '@/lib/lencana-dilihat';

const POLL_MS = 8000;

export interface ItemMenu {
  href: string;
  label: string;
  lencana?: keyof Lencana;
}

const KETERANGAN: Record<keyof Lencana, string> = {
  akun: 'akun baru menunggu persetujuan',
  izin: 'pengajuan izin baru',
  alfa: 'siswa alfa hari ini (baru)',
  wirid: 'jadwal wirid bulan ini belum diisi',
};

function bunyiNotif(c: AudioContext) {
  const nada = (f: number, mulai: number, dur: number) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, c.currentTime + mulai);
    g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + mulai + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + mulai + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + mulai);
    o.stop(c.currentTime + mulai + dur + 0.05);
  };
  nada(880, 0, 0.12);
  nada(1175, 0.13, 0.18);
}

function Penanda({ kunci, nilai, berdenyut }: { kunci: keyof Lencana; nilai: number; berdenyut: boolean }) {
  if (!nilai) return null;
  const teks = kunci === 'wirid' ? '!' : nilai > 99 ? '99+' : String(nilai);
  return (
    <span
      data-penanda={kunci}
      aria-label={`${kunci === 'wirid' ? '' : nilai + ' '}${KETERANGAN[kunci]}`}
      className={`ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white ${
        berdenyut ? 'animate-bounce' : ''
      }`}
    >
      {teks}
    </span>
  );
}

/** Memicu pembaruan angka setiap kali halaman atau parameternya berubah (misalnya setelah menyetujui akun). */
function PemicuUlang({ onUbah }: { onUbah: () => void }) {
  const pathname = usePathname();
  const kunci = useSearchParams()?.toString() ?? '';
  const pertama = useRef(true);
  useEffect(() => {
    if (pertama.current) {
      pertama.current = false;
      return;
    }
    onUbah();
  }, [pathname, kunci, onUbah]);
  return null;
}

export default function AdminNav({
  items,
  awal,
  pengguna = 'admin',
  intervalMs = POLL_MS,
}: {
  items: ItemMenu[];
  awal: Lencana;
  pengguna?: string;
  intervalMs?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const kunciSimpan = `az-dilihat-${pengguna}`;

  const [data, setData] = useState<Lencana>(awal);
  const [dilihat, setDilihat] = useState<Dilihat>({});
  const [siap, setSiap] = useState(false); // penanda baru ditampilkan setelah catatan "sudah dilihat" terbaca
  const [berdenyut, setBerdenyut] = useState<Partial<Record<keyof Lencana, boolean>>>({});

  const dataRef = useRef<Lencana>(awal);
  const dilihatRef = useRef<Dilihat>({});
  const sebelumnya = useRef<Lencana>(awal);
  const sedang = useRef(false);
  const audio = useRef<AudioContext | null>(null);

  const terapkan = useCallback(
    (baru: Dilihat) => {
      dilihatRef.current = baru;
      setDilihat(baru);
      simpanDilihat(window.localStorage, kunciSimpan, baru);
    },
    [kunciSimpan],
  );

  /** Menu dibuka atau diklik: jumlah saat ini dianggap sudah dilihat, penanda hilang. */
  const tandai = useCallback(
    (kunci: keyof Lencana) => terapkan(tandaiDilihat(dilihatRef.current, kunci, dataRef.current)),
    [terapkan],
  );

  // Baca catatan "sudah dilihat" dari penyimpanan peramban
  useEffect(() => {
    const awalDilihat = rapikanDilihat(bacaDilihat(window.localStorage, kunciSimpan), dataRef.current);
    dilihatRef.current = awalDilihat;
    setDilihat(awalDilihat);
    setSiap(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== kunciSimpan) return;
      const dari = rapikanDilihat(bacaDilihat(window.localStorage, kunciSimpan), dataRef.current);
      dilihatRef.current = dari;
      setDilihat(dari);
    };
    window.addEventListener('storage', onStorage); // tab lain menandai dilihat: ikut hilang di sini
    return () => window.removeEventListener('storage', onStorage);
  }, [kunciSimpan]);

  // Membuka halaman sebuah menu (lewat klik, alamat, atau tombol kembali) juga menandainya sudah dilihat
  useEffect(() => {
    if (!siap) return;
    for (const n of items) {
      if (!n.lencana) continue;
      const aktifSekarang = n.href === '/admin' ? pathname === '/admin' : pathname === n.href || pathname.startsWith(n.href + '/');
      if (aktifSekarang) tandai(n.lencana);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, siap]);

  // Aktifkan suara setelah interaksi pertama (aturan peramban)
  useEffect(() => {
    const buka = () => {
      try {
        if (!audio.current) {
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audio.current = new AC();
        }
        void audio.current.resume();
      } catch {
        /* tanpa suara */
      }
    };
    window.addEventListener('pointerdown', buka, { once: true });
    window.addEventListener('keydown', buka, { once: true });
    return () => {
      window.removeEventListener('pointerdown', buka);
      window.removeEventListener('keydown', buka);
    };
  }, []);

  const muat = useCallback(async () => {
    if (sedang.current) return;
    sedang.current = true;
    const ctrl = new AbortController();
    const batas = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch('/api/admin/lencana', { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) return;
      const j = (await res.json()) as { ok: boolean; data?: Lencana };
      if (!j.ok || !j.data) return;
      const baru = j.data;
      const lama = sebelumnya.current;
      const naik: Partial<Record<keyof Lencana, boolean>> = {};
      if (baru.akun > lama.akun) naik.akun = true;
      if (baru.izin > lama.izin) naik.izin = true;
      if (naik.akun || naik.izin) {
        setBerdenyut(naik);
        setTimeout(() => setBerdenyut({}), 4000);
        try {
          if (audio.current && audio.current.state === 'running') bunyiNotif(audio.current);
        } catch {
          /* tanpa suara */
        }
      }
      sebelumnya.current = baru;
      dataRef.current = baru;
      // jumlah turun (akun disetujui, dll): catatan "sudah dilihat" ikut diturunkan
      const rapi = rapikanDilihat(dilihatRef.current, baru);
      if (rapi !== dilihatRef.current) terapkan(rapi);
      setData((d) => (d.akun === baru.akun && d.izin === baru.izin && d.alfa === baru.alfa && d.wirid === baru.wirid ? d : baru));
    } catch {
      /* coba lagi pada putaran berikutnya */
    } finally {
      clearTimeout(batas);
      sedang.current = false;
    }
  }, [terapkan]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const mulai = (langsung: boolean) => {
      if (timer) clearInterval(timer);
      if (langsung) void muat();
      timer = setInterval(() => void muat(), intervalMs);
    };
    const berhenti = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisible = () => (document.hidden ? berhenti() : mulai(true));
    mulai(false);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      berhenti();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [muat, intervalMs]);

  const tampil = (k: keyof Lencana) => (siap ? jumlahBaru(k, data, dilihat) : 0);

  // Angka yang BELUM dilihat juga muncul di judul tab, misalnya "(3) Absensi Zuhur dan Wirid"
  const totalJudul = tampil('akun') + tampil('izin');
  useEffect(() => {
    const pasang = () => {
      const bersih = document.title.replace(/^\(\d+\+?\)\s/, '');
      document.title = totalJudul > 0 ? `(${totalJudul > 99 ? '99+' : totalJudul}) ${bersih}` : bersih;
    };
    pasang();
    const t = setTimeout(pasang, 150); // setelah Next selesai mengganti judul saat pindah halaman
    return () => clearTimeout(t);
  }, [totalJudul, pathname]);

  const aktif = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/'));

  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label="Menu admin">
      <Suspense fallback={null}>
        <PemicuUlang onUbah={() => void muat()} />
      </Suspense>
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => {
            if (n.lencana) tandai(n.lencana);
            if (aktif(n.href)) router.refresh(); // sudah di halaman ini: muat ulang datanya supaya yang baru ikut tampil
          }}
          className={`flex items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-brand-50 hover:text-brand-800 ${
            aktif(n.href) ? 'bg-brand-50 text-brand-800' : 'text-slate-600'
          }`}
        >
          {n.label}
          {n.lencana && <Penanda kunci={n.lencana} nilai={tampil(n.lencana)} berdenyut={!!berdenyut[n.lencana]} />}
        </Link>
      ))}
    </nav>
  );
}