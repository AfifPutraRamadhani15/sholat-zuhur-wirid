'use client';

import { useCallback, useEffect, useState } from 'react';

type Status = 'memeriksa' | 'belum_dikonfigurasi' | 'perlu_pasang' | 'tidak_didukung' | 'belum' | 'aktif' | 'ditolak' | 'proses';

const KUNCI_PUBLIK = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function kunciKeBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const mentah = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(mentah.length));
  for (let i = 0; i < mentah.length; i++) out[i] = mentah.charCodeAt(i);
  return out;
}

function ios(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function terpasang(): boolean {
  return (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

async function simpanKeServer(sub: PushSubscription): Promise<boolean> {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  return res.ok;
}

export default function AktifkanNotif() {
  const [status, setStatus] = useState<Status>('memeriksa');
  const [pesan, setPesan] = useState('');
  const [galat, setGalat] = useState('');

  const periksa = useCallback(async () => {
    if (!KUNCI_PUBLIK) return setStatus('belum_dikonfigurasi');
    const dukung = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!dukung) return setStatus(ios() && !terpasang() ? 'perlu_pasang' : 'tidak_didukung');
    if (Notification.permission === 'denied') return setStatus('ditolak');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') {
        void simpanKeServer(sub); // sinkronkan ulang supaya server selalu punya data terbaru
        setStatus('aktif');
      } else {
        setStatus('belum');
      }
    } catch {
      setStatus('tidak_didukung');
    }
  }, []);

  useEffect(() => {
    void periksa();
  }, [periksa]);

  async function aktifkan() {
    setGalat('');
    setPesan('');
    setStatus('proses');
    try {
      const izin = await Notification.requestPermission();
      if (izin !== 'granted') {
        setStatus(izin === 'denied' ? 'ditolak' : 'belum');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const lama = await reg.pushManager.getSubscription();
      const sub = lama ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunciKeBytes(KUNCI_PUBLIK) }));
      if (!(await simpanKeServer(sub))) {
        setGalat('Gagal menyimpan ke server. Coba lagi beberapa saat lagi.');
        setStatus('belum');
        return;
      }
      setStatus('aktif');
      setPesan('Notifikasi aktif. Tekan "Kirim tes" untuk mencobanya.');
    } catch {
      setGalat('Gagal mengaktifkan notifikasi di perangkat ini.');
      setStatus('belum');
    }
  }

  async function matikan() {
    setGalat('');
    setPesan('');
    setStatus('proses');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    } finally {
      setStatus('belum');
      setPesan('Notifikasi dimatikan di perangkat ini.');
    }
  }

  async function tes() {
    setGalat('');
    setPesan('');
    try {
      const res = await fetch('/api/push/tes', { method: 'POST' });
      const j = await res.json().catch(() => ({ ok: false, error: 'Terjadi kesalahan' }));
      if (j.ok) setPesan('Tes terkirim. Notifikasi akan muncul di layar HP dalam beberapa detik.');
      else setGalat(j.error ?? 'Tes gagal');
    } catch {
      setGalat('Tidak bisa terhubung ke server.');
    }
  }

  const kotak = 'card text-sm';

  if (status === 'memeriksa' || status === 'belum_dikonfigurasi') return null;

  if (status === 'perlu_pasang') {
    return (
      <div className={`${kotak} border-amber-200 bg-amber-50 text-amber-900`}>
        <div className="font-semibold">Notifikasi di iPhone</div>
        <p className="mt-1">
          Pasang aplikasi dulu: buka lewat Safari, ketuk tombol Bagikan, pilih <b>Tambah ke Layar Utama</b>, lalu buka aplikasi dari ikon di layar utama. Setelah itu tombol aktifkan notifikasi akan muncul di sini.
        </p>
      </div>
    );
  }

  if (status === 'tidak_didukung') {
    return (
      <div className={`${kotak} text-slate-600`}>
        Peramban ini belum mendukung notifikasi di layar. Pakai Chrome di Android, atau Safari di iPhone iOS 16.4 ke atas (aplikasi dipasang ke layar utama).
      </div>
    );
  }

  if (status === 'ditolak') {
    return (
      <div className={`${kotak} border-red-200 bg-red-50 text-red-900`}>
        <div className="font-semibold">Notifikasi diblokir</div>
        <p className="mt-1">Izin notifikasi ditolak. Aktifkan lagi lewat pengaturan notifikasi untuk aplikasi ini di HP (di iPhone: Pengaturan, Notifikasi, pilih aplikasi Absensi). Kalau pilihannya tidak ada, hapus ikon dari layar utama lalu pasang ulang.</p>
      </div>
    );
  }

  return (
    <div className={kotak}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Notifikasi di layar HP</div>
          <p className="text-xs text-slate-500">
            {status === 'aktif'
              ? 'Aktif. Kamu akan menerima pengingat sebelum Zuhur atau Wirid dan konfirmasi saat absen tercatat.'
              : 'Aktifkan untuk menerima pengingat sebelum Zuhur atau Wirid dan konfirmasi saat absen tercatat.'}
          </p>
        </div>
        <div className="flex gap-2">
          {status === 'aktif' ? (
            <>
              <button className="btn-outline btn-sm" onClick={() => void tes()}>
                Kirim tes
              </button>
              <button className="btn-outline btn-sm" onClick={() => void matikan()}>
                Matikan
              </button>
            </>
          ) : (
            <button className="btn-primary btn-sm" disabled={status === 'proses'} onClick={() => void aktifkan()}>
              {status === 'proses' ? 'Memproses...' : 'Aktifkan notifikasi'}
            </button>
          )}
        </div>
      </div>
      {pesan && <p className="mt-2 text-xs text-emerald-700">{pesan}</p>}
      {galat && <p className="mt-2 text-xs text-red-700">{galat}</p>}
    </div>
  );
}