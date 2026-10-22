'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { LABEL_STATUS, WARNA_STATUS, type StatusAbsen } from '@/lib/types';
import type { KegiatanSnap, KelasSnap, Seg, Snapshot, TrenSnap } from '@/lib/dashboard';

const POLL_MS = 5000;

const WARNA: Record<Seg, string> = {
  hadir: '#10b981',
  terlambat: '#f59e0b',
  izin: '#0ea5e9',
  sakit: '#6366f1',
  haid: '#ec4899',
  alfa: '#ef4444',
  belum: '#cbd5e1',
};
const URUT: Seg[] = ['hadir', 'terlambat', 'izin', 'sakit', 'haid', 'alfa', 'belum'];
const LABEL: Record<Seg, string> = { ...LABEL_STATUS, belum: 'Belum absen' };

const STATE_LABEL: Record<KegiatanSnap['state'], { teks: string; kelas: string }> = {
  belum_dibuka: { teks: 'Belum dibuka', kelas: 'bg-slate-100 text-slate-700' },
  hadir: { teks: 'Sedang berlangsung', kelas: 'bg-emerald-100 text-emerald-800' },
  terlambat: { teks: 'Masa terlambat', kelas: 'bg-amber-100 text-amber-800' },
  ditutup: { teks: 'Selesai', kelas: 'bg-slate-200 text-slate-700' },
};

/* ------------------------------------------------------------------ grafik */

function Donut({ nilai, total, persen }: { nilai: Record<Seg, number>; total: number; persen: number }) {
  const R = 48;
  const C = 2 * Math.PI * R;
  let geser = 0;
  const segmen = URUT.map((k) => {
    const len = total > 0 ? (nilai[k] / total) * C : 0;
    const s = { k, len, geser };
    geser += len;
    return s;
  }).filter((s) => s.len > 0);

  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-40 w-40" role="img" aria-label={`Kehadiran ${persen} persen`}>
      <circle cx="60" cy="60" r={R} fill="none" stroke="#e2e8f0" strokeWidth="14" />
      {segmen.map((s) => (
        <circle
          key={s.k}
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={WARNA[s.k]}
          strokeWidth="14"
          strokeDasharray={`${s.len} ${C - s.len}`}
          strokeDashoffset={-s.geser}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray .5s ease, stroke-dashoffset .5s ease' }}
        >
          <title>{`${LABEL[s.k]}: ${nilai[s.k]}`}</title>
        </circle>
      ))}
      <text x="60" y="58" textAnchor="middle" fill="#1e293b" style={{ fontSize: 22, fontWeight: 700 }}>
        {persen}%
      </text>
      <text x="60" y="75" textAnchor="middle" fill="#64748b" style={{ fontSize: 9 }}>
        hadir
      </text>
    </svg>
  );
}

function Legenda({ nilai, tampil }: { nilai: Record<Seg, number>; tampil: Seg[] }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {tampil.map((k) => (
        <li key={k} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: WARNA[k] }} />
            {LABEL[k]}
          </span>
          <b>{nilai[k]}</b>
        </li>
      ))}
    </ul>
  );
}

function GarisWaktu({ titik, total }: { titik: { t: string; v: number }[]; total: number }) {
  const ada = titik.length > 1 && titik[titik.length - 1].v > 0;
  if (!ada) {
    return <p className="py-10 text-center text-sm text-slate-500">Belum ada pemindaian pada kegiatan ini.</p>;
  }
  const W = 300;
  const H = 130;
  const PL = 28;
  const PR = 10;
  const PT = 12;
  const PB = 22;
  const maks = Math.max(total, ...titik.map((p) => p.v), 1);
  const x = (i: number) => PL + (i / (titik.length - 1)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - v / maks) * (H - PT - PB);
  const garis = titik.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const dasar = (H - PB).toFixed(1);
  const area = `${garis} L${x(titik.length - 1).toFixed(1)} ${dasar} L${x(0).toFixed(1)} ${dasar} Z`;
  const akhir = titik[titik.length - 1];
  const tengah = titik[Math.floor((titik.length - 1) / 2)];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Jumlah siswa yang sudah absen dari waktu ke waktu">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PL} x2={W - PR} y1={y(maks * f)} y2={y(maks * f)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={PL - 4} y={y(maks * f) + 3} textAnchor="end" fill="#94a3b8" style={{ fontSize: 8 }}>
            {Math.round(maks * f)}
          </text>
        </g>
      ))}
      <path d={area} fill="#10b981" fillOpacity="0.15" />
      <path d={garis} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(titik.length - 1)} cy={y(akhir.v)} r="3.5" fill="#059669" />
      <text x={Math.min(x(titik.length - 1), W - PR - 4)} y={y(akhir.v) - 7} textAnchor="end" fill="#047857" style={{ fontSize: 10, fontWeight: 700 }}>
        {akhir.v}
      </text>
      <text x={x(0)} y={H - 6} textAnchor="start" fill="#64748b" style={{ fontSize: 8 }}>
        {titik[0].t}
      </text>
      {titik.length > 4 && (
        <text x={x(Math.floor((titik.length - 1) / 2))} y={H - 6} textAnchor="middle" fill="#64748b" style={{ fontSize: 8 }}>
          {tengah.t}
        </text>
      )}
      <text x={x(titik.length - 1)} y={H - 6} textAnchor="end" fill="#64748b" style={{ fontSize: 8 }}>
        {akhir.t}
      </text>
    </svg>
  );
}

function BatangKelas({ daftar }: { daftar: KelasSnap[] }) {
  if (!daftar.length) return <p className="py-10 text-center text-sm text-slate-500">Belum ada data kelas.</p>;
  return (
    <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {daftar.map((k) => {
        const hadir = k.hadir + k.terlambat;
        const p = k.total ? Math.round((hadir / k.total) * 100) : 0;
        return (
          <li key={k.id}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{k.nama}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {hadir}/{k.total} • {p}%
              </span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${k.nama}: ${hadir} dari ${k.total} hadir`}>
              {URUT.map((s) => {
                const v = k[s];
                if (!v || !k.total) return null;
                return (
                  <div
                    key={s}
                    title={`${LABEL[s]}: ${v}`}
                    style={{ width: `${(v / k.total) * 100}%`, background: WARNA[s], transition: 'width .5s ease' }}
                  />
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Tren({ data }: { data: TrenSnap[] }) {
  if (!data.length) {
    return <p className="py-10 text-center text-sm text-slate-500">Belum ada kegiatan yang selesai untuk ditampilkan.</p>;
  }
  const W = 320;
  const H = 140;
  const PL = 26;
  const PR = 6;
  const PT = 14;
  const PB = 24;
  const slot = (W - PL - PR) / data.length;
  const lebar = Math.min(28, slot * 0.62);
  const tinggi = H - PT - PB;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Persentase kehadiran pada kegiatan terakhir">
      {[0, 50, 100].map((v) => {
        const yy = PT + (1 - v / 100) * tinggi;
        return (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={yy} y2={yy} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PL - 4} y={yy + 3} textAnchor="end" fill="#94a3b8" style={{ fontSize: 8 }}>
              {v}%
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.persen / 100) * tinggi;
        const bx = PL + i * slot + (slot - lebar) / 2;
        const by = PT + tinggi - h;
        return (
          <g key={`${d.tanggal}-${d.kegiatan}`}>
            <rect x={bx} y={by} width={lebar} height={Math.max(h, 0.5)} rx="3" fill={d.kegiatan === 'zuhur' ? '#10b981' : '#0ea5e9'} style={{ transition: 'height .5s ease, y .5s ease' }}>
              <title>{`${d.hari} ${d.label} (${d.kegiatan === 'zuhur' ? 'Zuhur' : 'Wirid'}): ${d.hadir} dari ${d.total} hadir (${d.persen}%)`}</title>
            </rect>
            {data.length <= 8 && (
              <text x={bx + lebar / 2} y={by - 3} textAnchor="middle" fill="#475569" style={{ fontSize: 8, fontWeight: 600 }}>
                {d.persen}
              </text>
            )}
            <text x={bx + lebar / 2} y={H - 8} textAnchor="middle" fill="#64748b" style={{ fontSize: 7.5 }}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------- kartu kegiatan */

function KartuKegiatan({ k }: { k: KegiatanSnap }) {
  const st = STATE_LABEL[k.state];
  const tampil: Seg[] = k.selesai ? ['hadir', 'terlambat', 'izin', 'sakit', 'haid', 'alfa'] : URUT;
  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">
            {k.label}{' '}
            <span className="text-sm font-normal text-slate-500">
              ({k.buka} sampai {k.tutup} WIB)
            </span>
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className={`badge ${st.kelas}`}>{st.teks}</span>
            <span>Tepat waktu sampai {k.tepat}</span>
          </div>
        </div>
        <Link href={`/admin/kehadiran?kegiatan=${k.kegiatan}`} className="btn-outline btn-sm">
          Lihat detail
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {tampil.map((s) => (
          <div key={s} className="rounded-xl bg-slate-50 p-3 text-center">
            <div className="text-2xl font-bold tabular-nums">{k.hitung[s]}</div>
            <span className={`badge ${s === 'belum' ? 'bg-slate-200 text-slate-700' : WARNA_STATUS[s as StatusAbsen]}`}>{LABEL[s]}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <h3 className="mb-2 text-sm font-semibold">Komposisi kehadiran</h3>
          <Donut nilai={k.hitung} total={k.total} persen={k.persenHadir} />
          <Legenda nilai={k.hitung} tampil={tampil} />
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <h3 className="mb-2 text-sm font-semibold">Siswa yang sudah absen (kumulatif)</h3>
          <GarisWaktu titik={k.garis} total={k.total} />
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <h3 className="mb-2 text-sm font-semibold">Per kelas</h3>
          <BatangKelas daftar={k.perKelas} />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- komponen utama */

const fmtJam = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export default function DashboardLive({ awal }: { awal: Snapshot }) {
  const [data, setData] = useState<Snapshot>(awal);
  const [terakhir, setTerakhir] = useState<Date | null>(null);
  const [putus, setPutus] = useState(false);
  const sedangRef = useRef(false);
  const lastRef = useRef(JSON.stringify(awal));

  const muat = useCallback(async () => {
    if (sedangRef.current) return;
    sedangRef.current = true;
    const ctrl = new AbortController();
    const batas = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch('/api/admin/dashboard', { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error('gagal');
      const json = (await res.json()) as { ok: boolean; data?: Snapshot };
      if (!json.ok || !json.data) throw new Error('gagal');
      const s = JSON.stringify(json.data);
      if (s !== lastRef.current) {
        lastRef.current = s;
        setData(json.data);
      }
      setTerakhir(new Date());
      setPutus(false);
    } catch {
      setPutus(true);
    } finally {
      clearTimeout(batas);
      sedangRef.current = false;
    }
  }, []);

  // pembaruan berkala, berhenti saat tab tidak terlihat supaya hemat baterai dan kuota
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const mulai = (langsung: boolean) => {
      if (timer) clearInterval(timer);
      if (langsung) void muat();
      timer = setInterval(() => void muat(), POLL_MS);
    };
    const berhenti = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisible = () => (document.hidden ? berhenti() : mulai(true));
    setTerakhir(new Date());
    mulai(false);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      berhenti();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [muat]);

  // pembaruan instan saat ada absensi baru (butuh SQL opsional realtime; tanpa itu tetap jalan lewat pembaruan berkala)
  useEffect(() => {
    const sb = supabaseBrowser();
    let tunda: ReturnType<typeof setTimeout> | undefined;
    const kanal = sb
      .channel('dashboard-absensi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'absensi' }, () => {
        if (tunda) clearTimeout(tunda);
        tunda = setTimeout(() => void muat(), 300);
      })
      .subscribe();
    return () => {
      if (tunda) clearTimeout(tunda);
      void sb.removeChannel(kanal);
    };
  }, [muat]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-600">
            {data.tanggalLabel} • {data.jam} WIB • {data.totalSiswa} siswa aktif
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5" aria-live="polite">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${putus ? 'bg-amber-500' : 'animate-pulse bg-emerald-500'}`} />
            {putus ? 'Koneksi terputus, mencoba lagi' : terakhir ? `Langsung • ${fmtJam.format(terakhir).replace(/\./g, ':')}` : 'Langsung'}
          </span>
          <button className="btn-outline btn-sm" onClick={() => void muat()}>
            Muat ulang
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/verifikasi" className="card flex items-center justify-between hover:border-brand-500">
          <span className="font-semibold">Akun menunggu persetujuan</span>
          <span className={`badge ${data.akunMenunggu ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{data.akunMenunggu}</span>
        </Link>
        <Link href="/admin/izin" className="card flex items-center justify-between hover:border-brand-500">
          <span className="font-semibold">Pengajuan izin menunggu</span>
          <span className={`badge ${data.izinMenunggu ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{data.izinMenunggu}</span>
        </Link>
      </div>

      {data.kegiatan.length === 0 ? (
        <div className="card text-sm text-slate-600">Hari ini tidak ada kegiatan Zuhur maupun Wirid.</div>
      ) : (
        data.kegiatan.map((k) => <KartuKegiatan key={k.kegiatan} k={k} />)
      )}

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Tren kehadiran (kegiatan terakhir)</h2>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Zuhur
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" />
              Wirid
            </span>
          </div>
        </div>
        <p className="mb-2 text-xs text-slate-500">Persentase siswa yang hadir atau terlambat dari seluruh siswa aktif.</p>
        <Tren data={data.tren} />
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">Pemindaian terbaru</h2>
        {data.terbaru.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada absensi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Waktu</th>
                  <th className="th">Siswa</th>
                  <th className="th">Kegiatan</th>
                  <th className="th">Status</th>
                  <th className="th hidden sm:table-cell">Dipindai oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.terbaru.map((r, i) => (
                  <tr key={`${r.jam}-${r.nama}-${i}`}>
                    <td className="td whitespace-nowrap tabular-nums">{r.jam}</td>
                    <td className="td">{r.nama}</td>
                    <td className="td capitalize">{r.kegiatan}</td>
                    <td className="td">
                      <span className={`badge ${WARNA_STATUS[r.status]}`}>{LABEL_STATUS[r.status]}</span>
                    </td>
                    <td className="td hidden sm:table-cell">{r.oleh}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}