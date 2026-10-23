'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

const K_AKTIVITAS = 'oto-keluar:aktivitas'; // waktu aktivitas terakhir (dibagi semua tab)
const K_DENYUT = 'oto-keluar:denyut'; // tanda "masih ada tab terbuka"
const K_TAB = 'oto-keluar:tab'; // penanda per-tab (hilang saat tab ditutup)
const BATAS_DENYUT_MS = 60_000;

interface Props {
  batasMenit?: number;
  peringatanDetik?: number;
  halamanLogin?: string;
  /** Halaman yang tidak dihitung idle (mis. scanner kamera yang dipakai terus tanpa menyentuh layar). */
  abaikanIdle?: string[];
}

export default function OtoKeluar({
  batasMenit = 10,
  peringatanDetik = 60,
  halamanLogin = '/login',
  abaikanIdle = ['/scanner', '/scan'],
}: Props) {
  const [sisa, setSisa] = useState<number | null>(null);
  const reset = useRef<() => void>(() => {});

  useEffect(() => {
    const batasMs = batasMenit * 60_000;
    const dilogin = () => window.location.pathname.startsWith(halamanLogin);
    const baca = (k: string) => {
      try { return Number(localStorage.getItem(k) ?? 0); } catch { return 0; }
    };
    const tulis = (k: string, v: number) => {
      try { localStorage.setItem(k, String(v)); } catch { /* abaikan */ }
    };

    async function keluar(alasan: 'idle' | 'tab') {
      try { await supabaseBrowser().auth.signOut({ scope: 'local' }); } catch { /* abaikan */ }
      try { localStorage.removeItem(K_AKTIVITAS); localStorage.removeItem(K_DENYUT); } catch { /* abaikan */ }
      window.location.replace(`${halamanLogin}?alasan=${alasan}`);
    }

    let batal = false;
    const timers: ReturnType<typeof setInterval>[] = [];

    async function mulai() {
      // 1. Tab ini baru (bukan reload) dan tidak ada tab lain yang hidup = browser/tab sebelumnya sudah ditutup
      let tabAda = false;
      try { tabAda = sessionStorage.getItem(K_TAB) === '1'; } catch { /* abaikan */ }
      if (!tabAda && !dilogin() && Date.now() - baca(K_DENYUT) > BATAS_DENYUT_MS) {
        const { data } = await supabaseBrowser().auth.getSession();
        if (data.session) {
          await keluar('tab');
          return;
        }
      }
      if (batal) return;
      try { sessionStorage.setItem(K_TAB, '1'); } catch { /* abaikan */ }
      tulis(K_DENYUT, Date.now());
      tulis(K_AKTIVITAS, Date.now());

      // 2. Denyut: tanda bahwa ada tab yang masih terbuka
      const denyut = () => tulis(K_DENYUT, Date.now());
      timers.push(setInterval(denyut, 5000));
      const saatTampil = () => { if (document.visibilityState === 'visible') denyut(); };
      document.addEventListener('visibilitychange', saatTampil);
      window.addEventListener('focus', denyut);

      // 3. Catat aktivitas pengguna
      let terakhirTulis = 0;
      const aktif = () => {
        const n = Date.now();
        if (n - terakhirTulis < 2000) return;
        terakhirTulis = n;
        tulis(K_AKTIVITAS, n);
      };
      const acara = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'click'] as const;
      acara.forEach((a) => window.addEventListener(a, aktif, { passive: true }));
      reset.current = () => { terakhirTulis = 0; aktif(); setSisa(null); };

      // 4. Periksa idle tiap 5 detik
      timers.push(
        setInterval(() => {
          if (dilogin()) return setSisa(null);
          const path = window.location.pathname;
          if (abaikanIdle.some((p) => path.includes(p))) {
            tulis(K_AKTIVITAS, Date.now());
            return setSisa(null);
          }
          const idle = Date.now() - baca(K_AKTIVITAS);
          if (idle >= batasMs) {
            void keluar('idle');
          } else if (idle >= batasMs - peringatanDetik * 1000) {
            setSisa(Math.ceil((batasMs - idle) / 1000));
          } else {
            setSisa(null);
          }
        }, 5000),
      );

      cleanup = () => {
        timers.forEach(clearInterval);
        document.removeEventListener('visibilitychange', saatTampil);
        window.removeEventListener('focus', denyut);
        acara.forEach((a) => window.removeEventListener(a, aktif));
      };
    }

    let cleanup = () => {};
    void mulai();
    return () => {
      batal = true;
      timers.forEach(clearInterval);
      cleanup();
    };
  }, [batasMenit, peringatanDetik, halamanLogin, abaikanIdle]);

  if (sisa === null) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 shadow-lg">
      <div className="font-semibold">Sesi akan berakhir</div>
      <p className="mt-1">Tidak ada aktivitas. Kamu akan keluar otomatis dalam {sisa} detik.</p>
      <button className="btn-primary btn-sm mt-2" onClick={() => reset.current()}>
        Tetap masuk
      </button>
    </div>
  );
}