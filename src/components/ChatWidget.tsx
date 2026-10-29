'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

interface Msg {
  id: string;
  role: 'bot' | 'user';
  tipe: 'notifikasi' | 'ai';
  isi: string;
  created_at: string;
}

const CEPAT = ['Rekap bulan ini', 'Status absen hari ini', 'Jadwal Zuhur dan Wirid'];

export default function ChatWidget({ userId }: { userId: string }) {
  const [buka, setBuka] = useState(false);
  const [pesan, setPesan] = useState<Msg[]>([]);
  const [teks, setTeks] = useState('');
  const [kirim, setKirim] = useState(false);
  const [belumDibaca, setBelumDibaca] = useState(0);
  const [banner, setBanner] = useState<Msg | null>(null);
  const bukaRef = useRef(false);
  const bawahRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  bukaRef.current = buka;

  const tambah = useCallback((daftar: Msg[], dariBaru: boolean) => {
    setPesan((prev) => {
      const ada = new Set(prev.map((m) => m.id));
      const baru = daftar.filter((m) => !ada.has(m.id));
      if (!baru.length) return prev;
      if (dariBaru) {
        const bot = baru.filter((m) => m.role === 'bot');
        // Beranda siswa ikut diperbarui seketika saat notifikasi absen masuk
        if (bot.some((m) => m.tipe === 'notifikasi')) window.dispatchEvent(new CustomEvent('absensi-baru'));
        if (bot.length && !bukaRef.current) {
          setBelumDibaca((n) => n + bot.length);
          const notif = bot.find((m) => m.tipe === 'notifikasi');
          if (notif) {
            setBanner(notif);
            setTimeout(() => setBanner((b) => (b?.id === notif.id ? null : b)), 8000);
            try {
              const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
              audioRef.current = audioRef.current ?? new AC();
              const c = audioRef.current;
              const o = c.createOscillator();
              const g = c.createGain();
              o.frequency.value = 1040;
              g.gain.setValueAtTime(0.0001, c.currentTime);
              g.gain.exponentialRampToValueAtTime(0.15, c.currentTime + 0.02);
              g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.3);
              o.connect(g).connect(c.destination);
              o.start();
              o.stop(c.currentTime + 0.32);
            } catch {
              /* peramban memblokir suara sebelum ada interaksi */
            }
          }
        }
      }
      return [...prev, ...baru].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    });
  }, []);

  // riwayat awal
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/chat', { cache: 'no-store' });
        const j = await res.json();
        if (j.ok) tambah(j.pesan as Msg[], false);
      } catch {
        /* abaikan */
      }
    })();
  }, [tambah]);

  // notifikasi realtime + cadangan polling
  useEffect(() => {
    const sb = supabaseBrowser();
    const kanal = sb
      .channel(`chat:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `siswa_id=eq.${userId}` },
        (payload) => tambah([payload.new as Msg], true),
      )
      .subscribe();
    const poll = setInterval(async () => {
      try {
        const terakhir = pesanRef.current.length ? pesanRef.current[pesanRef.current.length - 1].created_at : '';
        const res = await fetch(`/api/chat${terakhir ? `?after=${encodeURIComponent(terakhir)}` : ''}`, { cache: 'no-store' });
        const j = await res.json();
        if (j.ok) tambah(j.pesan as Msg[], true);
      } catch {
        /* coba lagi */
      }
    }, 10_000);
    return () => {
      clearInterval(poll);
      void sb.removeChannel(kanal);
    };
  }, [userId, tambah]);

  const pesanRef = useRef<Msg[]>([]);
  pesanRef.current = pesan;

  useEffect(() => {
    if (buka) bawahRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pesan, buka]);

  async function tanya(isi: string) {
    const t = isi.trim();
    if (!t || kirim) return;
    setKirim(true);
    setTeks('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesan: t }),
      });
      const j = await res.json();
      if (j.ok) tambah(j.pesan as Msg[], false);
      else
        tambah(
          [{ id: `err-${Date.now()}`, role: 'bot', tipe: 'ai', isi: j.error || 'Maaf, ada gangguan.', created_at: new Date().toISOString() }],
          false,
        );
    } catch {
      tambah(
        [{ id: `err-${Date.now()}`, role: 'bot', tipe: 'ai', isi: 'Tidak bisa terhubung ke server.', created_at: new Date().toISOString() }],
        false,
      );
    } finally {
      setKirim(false);
    }
  }

  return (
    <>
      {banner && !buka && (
        <button
          onClick={() => {
            setBuka(true);
            setBelumDibaca(0);
            setBanner(null);
          }}
          className="no-print fixed bottom-24 right-4 z-40 max-w-[18rem] rounded-2xl border border-emerald-200 bg-white p-3 text-left text-sm shadow-lg"
        >
          <div className="mb-0.5 text-xs font-bold text-brand-700">Asisten Absensi</div>
          {banner.isi}
        </button>
      )}

      <button
        aria-label="Buka chatbot"
        onClick={() => {
          setBuka((b) => !b);
          setBelumDibaca(0);
          setBanner(null);
        }}
        className="no-print fixed bottom-5 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand-700 text-2xl text-white shadow-lg hover:bg-brand-800"
      >
        {buka ? '✕' : '💬'}
        {!buka && belumDibaca > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs font-bold">
            {belumDibaca}
          </span>
        )}
      </button>

      {buka && (
        <div className="no-print fixed bottom-24 right-4 z-40 flex h-[28rem] max-h-[70vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="bg-brand-700 px-4 py-3 text-white">
            <div className="font-bold">Asisten Absensi</div>
            <div className="text-xs text-emerald-100">Notifikasi absen dan tanya jawab</div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
            {pesan.length === 0 && (
              <p className="rounded-lg bg-white p-3 text-sm text-slate-600">
                Halo! Notifikasi absenmu akan muncul di sini. Kamu juga bisa bertanya soal rekap, status hari ini, atau jadwal.
              </p>
            )}
            {pesan.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-brand-700 text-white'
                      : m.tipe === 'notifikasi'
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'bg-white text-slate-800 shadow-sm'
                  }`}
                >
                  {m.tipe === 'notifikasi' && <div className="mb-0.5 text-[10px] font-bold uppercase text-emerald-700">Notifikasi absen</div>}
                  {m.isi}
                </div>
              </div>
            ))}
            {kirim && <div className="text-xs text-slate-500">Mengetik...</div>}
            <div ref={bawahRef} />
          </div>
          <div className="border-t border-slate-200 bg-white p-2">
            <div className="mb-2 flex gap-1 overflow-x-auto">
              {CEPAT.map((c) => (
                <button key={c} onClick={() => void tanya(c)} className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-1 text-xs hover:bg-slate-100">
                  {c}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void tanya(teks);
              }}
            >
              <input className="input" placeholder="Tulis pertanyaan..." maxLength={300} value={teks} onChange={(e) => setTeks(e.target.value)} />
              <button className="btn-primary" disabled={kirim || !teks.trim()}>
                Kirim
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}