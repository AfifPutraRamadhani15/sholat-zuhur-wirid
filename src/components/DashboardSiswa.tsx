'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ItemHariIni, PapanItem, RingkasanSiswa, RiwayatItem } from '@/lib/ringkasan-siswa';
import { LABEL_KEGIATAN, LABEL_STATUS, WARNA_STATUS, type StatusAbsen } from '@/lib/types';

const POLL_NORMAL = 7000;
const POLL_CEPAT = 2000; // saat menunggu foto bukti selesai diunggah
const BATAS_CEPAT = 15;

const tanda = (n: number) => (n > 0 ? `+${n}` : String(n));

/* ------------------------------------------------------------- kegiatan hari ini */

function KartuHariIni({ k }: { k: ItemHariIni }) {
  const s = k.sudah;
  const hadir = s && (s.status === 'hadir' || s.status === 'terlambat');

  if (s) {
    const warna = hadir ? 'border-emerald-300 bg-emerald-50' : 'border-sky-300 bg-sky-50';
    return (
      <div className={`rounded-2xl border-2 p-4 ${warna}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-bold">{k.label}</h3>
          <span className={`badge ${WARNA_STATUS[s.status]}`}>{s.statusLabel}</span>
        </div>
        <div className="flex gap-3">
          {hadir &&
            (s.foto ? (
              <a href={s.foto} target="_blank" rel="noreferrer" className="shrink-0" aria-label="Lihat foto bukti scan">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.foto} alt="Foto bukti saat scan" className="h-24 w-24 rounded-xl border border-white object-cover shadow" />
              </a>
            ) : (
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-white/70 p-2 text-center text-[11px] text-slate-500">
                Foto sedang diproses
              </div>
            ))}
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-sm text-white" aria-hidden>
                ✓
              </span>
              {hadir ? 'Sudah absen' : 'Tercatat'}
            </div>
            <div className="text-sm">
              {hadir ? 'Dipindai pukul ' : 'Dicatat pukul '}
              <b className="tabular-nums">{s.jam}</b> WIB
            </div>
            {s.pemindai && <div className="text-xs text-slate-600">Dipindai oleh {s.pemindai}</div>}
            {s.keterangan && <div className="text-xs text-slate-600">{s.keterangan}</div>}
            {hadir && (
              <div className={`pt-1 text-base font-extrabold ${s.poin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{tanda(s.poin)} poin</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (k.alfa) {
    return (
      <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="font-bold">{k.label}</h3>
          <span className={`badge ${WARNA_STATUS.alfa}`}>Alfa</span>
        </div>
        <p className="text-sm text-red-900">Kamu tidak absen. Poin berkurang 1 untuk kegiatan ini.</p>
      </div>
    );
  }

  const berlangsung = k.state === 'hadir' || k.state === 'terlambat';
  return (
    <div className={`rounded-2xl border-2 p-4 ${berlangsung ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="font-bold">{k.label}</h3>
        <span className="badge bg-slate-100 text-slate-700">{k.state === 'ditutup' ? 'Ditutup' : 'Belum absen'}</span>
      </div>
      <p className="text-sm text-slate-700">{k.pesan}</p>
      {k.poinJikaSekarang !== null && (
        <p className="mt-2 text-sm font-semibold text-amber-800">
          Scan sekarang dapat +{k.poinJikaSekarang} poin. Makin cepat, makin besar.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- poin & skor */

function DonatSkor({ skor }: { skor: number | null }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const isi = skor === null ? 0 : (skor / 100) * C;
  const warna = skor === null ? '#cbd5e1' : skor >= 85 ? '#10b981' : skor >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24" role="img" aria-label={skor === null ? 'Skor kehadiran belum ada' : `Skor kehadiran ${skor} persen`}>
      <circle cx="40" cy="40" r={R} fill="none" stroke="#e2e8f0" strokeWidth="9" />
      <circle
        cx="40"
        cy="40"
        r={R}
        fill="none"
        stroke={warna}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${isi} ${C - isi}`}
        transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dasharray .6s ease' }}
      />
      <text x="40" y="42" textAnchor="middle" fill="#1e293b" style={{ fontSize: 17, fontWeight: 800 }}>
        {skor === null ? '-' : `${skor}%`}
      </text>
      <text x="40" y="55" textAnchor="middle" fill="#64748b" style={{ fontSize: 7.5 }}>
        kehadiran
      </text>
    </svg>
  );
}

function KartuPoin({ d }: { d: RingkasanSiswa }) {
  const p = d.poin;
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Poin {d.bulanLabel}</div>
          <div className="text-5xl font-extrabold tabular-nums text-brand-700">{p.bulan}</div>
          {p.hariIni !== 0 && (
            <div className={`text-sm font-bold ${p.hariIni > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{tanda(p.hariIni)} hari ini</div>
          )}
        </div>
        <DonatSkor skor={d.skor} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="badge bg-orange-100 text-orange-800">🔥 {p.streak} beruntun</span>
        <span className="badge bg-amber-100 text-amber-800">
          🏆 Peringkat {d.peringkat.posisi} dari {d.peringkat.dari}
        </span>
        {d.ketepatan !== null && <span className="badge bg-emerald-100 text-emerald-800">⏱ {d.ketepatan}% tepat waktu</span>}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          { n: p.hadir, l: 'Tepat waktu', w: 'bg-emerald-100 text-emerald-800' },
          { n: p.terlambat, l: 'Terlambat', w: 'bg-amber-100 text-amber-800' },
          { n: p.izinSakitHaid, l: 'Izin/sakit', w: 'bg-sky-100 text-sky-800' },
          { n: p.alfa, l: 'Alfa', w: 'bg-red-100 text-red-800' },
        ].map((x) => (
          <div key={x.l} className="rounded-xl bg-slate-50 py-2">
            <div className="text-xl font-bold tabular-nums">{x.n}</div>
            <span className={`badge text-[10px] ${x.w}`}>{x.l}</span>
          </div>
        ))}
      </div>

      {p.potonganAlfa > 0 && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          Poin berkurang {p.potonganAlfa} bulan ini karena {p.alfa} kali tidak absen (1 poin per kegiatan). Hadir tepat waktu membuatnya naik lagi.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------ podium */

const PODIUM: Record<number, { medali: string; blok: string; tinggi: string; cincin: string }> = {
  1: { medali: '🥇', blok: 'from-amber-300 to-amber-500', tinggi: 'h-24', cincin: 'ring-amber-400' },
  2: { medali: '🥈', blok: 'from-slate-300 to-slate-400', tinggi: 'h-16', cincin: 'ring-slate-400' },
  3: { medali: '🥉', blok: 'from-orange-300 to-orange-500', tinggi: 'h-12', cincin: 'ring-orange-400' },
};

function Podium({ papan, bulan }: { papan: PapanItem[]; bulan: string }) {
  const per = new Map(papan.map((p) => [p.posisi, p]));
  const susunan = [2, 1, 3].map((n) => per.get(n));
  return (
    <section className="card">
      <div className="mb-3">
        <h2 className="font-bold">Peringkat poin 3 teratas</h2>
        <p className="text-xs text-slate-500">{bulan}</p>
      </div>
      {papan.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">Belum ada poin bulan ini. Jadilah yang pertama absen!</p>
      ) : (
        <div className="grid grid-cols-3 items-end gap-2">
          {susunan.map((p, i) => {
            if (!p) return <div key={i} />;
            const gaya = PODIUM[p.posisi];
            return (
              <div key={p.posisi} className="flex min-w-0 flex-col items-center text-center">
                <div className="text-3xl" aria-hidden>
                  {gaya.medali}
                </div>
                <div className={`mt-1 w-full rounded-lg px-1 py-1 ${p.saya ? `bg-brand-50 ring-2 ${gaya.cincin}` : ''}`}>
                  <div className="line-clamp-2 break-words text-xs font-bold leading-tight">{p.nama}</div>
                  <div className="truncate text-[10px] text-slate-500">{p.saya ? 'Kamu • ' : ''}{p.kelas ?? ''}</div>
                </div>
                <div className={`mt-1 grid w-full place-items-center rounded-t-xl bg-gradient-to-b ${gaya.blok} ${gaya.tinggi}`}>
                  <div className="text-xl font-extrabold tabular-nums text-white drop-shadow">{p.poin}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- aturan + riwayat */

function Aturan({ d }: { d: RingkasanSiswa }) {
  const a = d.aturan;
  return (
    <details className="card group text-sm">
      <summary className="cursor-pointer list-none font-bold">
        Cara kerja poin <span className="text-xs font-normal text-slate-500">(ketuk untuk membuka)</span>
      </summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-700">
        <li>
          <b>Hadir tepat waktu:</b> sampai {a.zuhur.maks} poin untuk Salat Zuhur dan sampai {a.wirid.maks} poin untuk Wirid Remaja. Makin cepat kamu scan setelah absen dibuka, makin besar poinnya (turun sampai {a.zuhur.min} dan {a.wirid.min} poin di batas tepat waktu).
        </li>
        <li>
          <b>Terlambat:</b> hanya {a.zuhur.terlambat} poin (Zuhur) atau {a.wirid.terlambat} poin (Wirid).
        </li>
        <li>
          <b>Bonus beruntun:</b> +1 poin untuk setiap kegiatan berturut-turut yang kamu hadiri, sampai +{a.bonusMaks}.
        </li>
        <li>
          <b>Tidak absen (alfa):</b> poin <b>berkurang {a.potonganAlfa}</b> untuk setiap kegiatan yang kamu lewatkan, dan bonus beruntunmu kembali ke 0.
        </li>
        <li>Izin, sakit, atau haid yang disetujui tidak menambah dan tidak mengurangi poin.</li>
        <li>Hari tanpa kegiatan (misalnya libur sekolah) tidak dihitung.</li>
        <li>Poin dihitung per bulan, mulai dari 0 setiap awal bulan, dan tidak bisa kurang dari 0.</li>
        <li>
          <b>Skor kehadiran</b> adalah persentase kamu hadir dari semua kegiatan yang wajib diikuti bulan ini.
        </li>
      </ul>
    </details>
  );
}

function BarisRiwayat({ r }: { r: RiwayatItem }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      {r.foto ? (
        <a href={r.foto} target="_blank" rel="noreferrer" className="shrink-0" aria-label="Lihat foto bukti scan">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.foto} alt="Foto bukti" loading="lazy" className="h-10 w-10 rounded-lg object-cover" />
        </a>
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {LABEL_KEGIATAN[r.kegiatan]} <span className="font-normal text-slate-500">• {r.hari}</span>
        </div>
        <div className="text-xs text-slate-500">{r.jam ? `Pukul ${r.jam} WIB` : r.status === 'alfa' ? 'Tidak absen' : 'Tanpa scan'}</div>
      </div>
      <div className="text-right">
        <span className={`badge ${WARNA_STATUS[r.status as StatusAbsen]}`}>{LABEL_STATUS[r.status as StatusAbsen]}</span>
        <div className={`text-xs font-bold tabular-nums ${r.poin > 0 ? 'text-emerald-600' : r.poin < 0 ? 'text-red-600' : 'text-slate-400'}`}>
          {r.poin === 0 ? '0 poin' : `${tanda(r.poin)} poin`}
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ komponen utama */

export default function DashboardSiswa({ awal, aksi }: { awal: RingkasanSiswa; aksi?: React.ReactNode }) {
  const [d, setD] = useState<RingkasanSiswa>(awal);
  const [putus, setPutus] = useState(false);
  const dataRef = useRef<RingkasanSiswa>(awal);
  const lastRef = useRef(JSON.stringify(awal));
  const sedang = useRef(false);
  const cepatRef = useRef(0);
  const jadwalUlang = useRef<() => void>(() => undefined);

  const muat = useCallback(async () => {
    if (sedang.current) return;
    sedang.current = true;
    const ctrl = new AbortController();
    const batas = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch('/api/siswa/ringkasan', { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error('gagal');
      const j = (await res.json()) as { ok: boolean; data?: RingkasanSiswa };
      if (!j.ok || !j.data) throw new Error('gagal');
      const s = JSON.stringify(j.data);
      if (s !== lastRef.current) {
        lastRef.current = s;
        dataRef.current = j.data;
        setD(j.data);
      }
      setPutus(false);
    } catch {
      setPutus(true);
    } finally {
      clearTimeout(batas);
      sedang.current = false;
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let aktif = true;
    const menungguFoto = () =>
      dataRef.current.hariIni.some((h) => h.sudah && (h.sudah.status === 'hadir' || h.sudah.status === 'terlambat') && !h.sudah.foto);
    const jadwal = () => {
      if (timer) clearTimeout(timer);
      if (!aktif || document.hidden) return;
      const cepat = menungguFoto() && cepatRef.current < BATAS_CEPAT;
      if (cepat) cepatRef.current += 1;
      else if (!menungguFoto()) cepatRef.current = 0;
      timer = setTimeout(async () => {
        await muat();
        jadwal();
      }, cepat ? POLL_CEPAT : POLL_NORMAL);
    };
    jadwalUlang.current = jadwal;
    const onVisible = () => {
      if (document.hidden) {
        if (timer) clearTimeout(timer);
      } else {
        void muat().then(jadwal);
      }
    };
    // notifikasi absen masuk (dari ChatWidget): perbarui seketika
    const onAbsen = () => {
      cepatRef.current = 0;
      void muat().then(jadwal);
    };
    jadwal();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('absensi-baru', onAbsen);
    window.addEventListener('focus', onVisible);
    return () => {
      aktif = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('absensi-baru', onAbsen);
      window.removeEventListener('focus', onVisible);
    };
  }, [muat]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Halo, {d.nama.split(' ')[0]}</h1>
          <p className="text-sm text-slate-600">{d.tanggalLabel}</p>
        </div>
        {putus && <span className="badge bg-amber-100 text-amber-800">Koneksi terputus</span>}
      </div>

      <section className="space-y-3" aria-label="Kegiatan hari ini">
        <h2 className="font-bold">Kegiatan hari ini</h2>
        {d.hariIni.length === 0 ? (
          <div className="card text-sm text-slate-600">Hari ini tidak ada kegiatan Zuhur maupun Wirid.</div>
        ) : (
          d.hariIni.map((k) => <KartuHariIni key={k.kegiatan} k={k} />)
        )}
      </section>

      {aksi}

      <KartuPoin d={d} />
      <Podium papan={d.papan} bulan={d.bulanLabel} />
      <Aturan d={d} />

      <section className="card">
        <h2 className="mb-1 font-bold">Riwayat {d.bulanLabel}</h2>
        {d.riwayat.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada riwayat bulan ini.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {d.riwayat.map((r) => (
              <BarisRiwayat key={`${r.tanggal}-${r.kegiatan}`} r={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}