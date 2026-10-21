import { supabaseAdmin } from '@/lib/supabase/admin';
import Flash from '@/components/Flash';
import { absensiManual } from '../actions';
import { awalBulan, formatJamWIB, formatTanggalID, jendelaKegiatan, nowWIB, toMenit } from '@/lib/jadwal';
import { LABEL_KEGIATAN, LABEL_STATUS, WARNA_STATUS, type Kegiatan, type StatusAbsen } from '@/lib/types';
import { satu } from '@/lib/util';

type Baris = {
  id: string;
  nisn: string;
  nama: string;
  kelasId: string | null;
  kelas: string;
  status: StatusAbsen | 'belum';
  jam: string;
  metode: string;
  guru: string;
  foto: string | null;
  catatan: string | null;
};

export default async function Kehadiran({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sb = supabaseAdmin();
  const now = nowWIB();
  const tanggal = sp.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal) ? sp.tanggal : now.tanggal;
  const kegiatan: Kegiatan = sp.kegiatan === 'wirid' ? 'wirid' : 'zuhur';
  const j = await jendelaKegiatan(sb, kegiatan, tanggal);
  const selesai = !!j && (tanggal < now.tanggal || (tanggal === now.tanggal && now.detik > toMenit(j.tutup) * 60));

  const [{ data: siswa }, { data: absen }, { data: kelas }] = await Promise.all([
    sb
      .from('profiles')
      .select('id,nama,siswa_detail(nisn,kelas_id,kelas:kelas_id(nama))')
      .eq('role', 'siswa')
      .eq('status', 'aktif')
      .order('nama'),
    sb
      .from('absensi')
      .select('*,scanner:profiles!absensi_scanner_id_fkey(nama)')
      .eq('tanggal', tanggal)
      .eq('kegiatan', kegiatan),
    sb.from('kelas').select('id,nama').order('nama'),
  ]);

  const peta = new Map((absen ?? []).map((a) => [a.siswa_id as string, a]));
  const paths = (absen ?? []).map((a) => a.foto_path).filter(Boolean) as string[];
  const url = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await sb.storage.from('bukti-absensi').createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) url.set(s.path, s.signedUrl);
  }

  let baris: Baris[] = (siswa ?? []).map((s) => {
    const sd = satu(s.siswa_detail as { nisn: string; kelas_id: string | null; kelas: unknown } | { nisn: string; kelas_id: string | null; kelas: unknown }[]);
    const a = peta.get(s.id);
    const guru = satu(a?.scanner as { nama: string } | { nama: string }[] | undefined)?.nama;
    return {
      id: s.id,
      nisn: sd?.nisn ?? '-',
      nama: s.nama,
      kelasId: sd?.kelas_id ?? null,
      kelas: satu(sd?.kelas as { nama: string } | { nama: string }[] | undefined)?.nama ?? '-',
      status: a ? (a.status as StatusAbsen) : selesai ? 'alfa' : 'belum',
      jam: a ? formatJamWIB(a.scanned_at) : '-',
      metode: a ? (a.metode as string) : '-',
      guru: guru ?? (a?.metode === 'izin' ? 'Izin disetujui' : a?.metode === 'manual' ? 'Input manual' : '-'),
      foto: a?.foto_path ? url.get(a.foto_path) ?? null : null,
      catatan: a?.catatan ?? null,
    };
  });

  const ringkas: Record<string, number> = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, haid: 0, alfa: 0, belum: 0 };
  for (const b of baris) ringkas[b.status] += 1;

  if (sp.kelas) baris = baris.filter((b) => b.kelasId === sp.kelas);
  if (sp.status) baris = baris.filter((b) => b.status === sp.status);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Kehadiran</h1>
        <p className="text-sm text-slate-600">
          {LABEL_KEGIATAN[kegiatan]} • {formatTanggalID(tanggal)}
        </p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Tanggal</label>
          <input type="date" name="tanggal" defaultValue={tanggal} className="input" />
        </div>
        <div>
          <label className="label">Kegiatan</label>
          <select name="kegiatan" defaultValue={kegiatan} className="input">
            <option value="zuhur">Salat Zuhur</option>
            <option value="wirid">Wirid Remaja</option>
          </select>
        </div>
        <div>
          <label className="label">Kelas</label>
          <select name="kelas" defaultValue={sp.kelas ?? ''} className="input">
            <option value="">Semua kelas</option>
            {kelas?.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={sp.status ?? ''} className="input">
            <option value="">Semua</option>
            {(Object.keys(LABEL_STATUS) as StatusAbsen[]).map((s) => <option key={s} value={s}>{LABEL_STATUS[s]}</option>)}
            <option value="belum">Belum absen</option>
          </select>
        </div>
        <button className="btn-primary">Tampilkan</button>
      </form>

      {!j ? (
        <div className="card text-sm text-slate-600">
          Tidak ada kegiatan {LABEL_KEGIATAN[kegiatan]} pada tanggal ini (Zuhur berlangsung Senin sampai Kamis, Wirid sesuai jadwal di Master Data).
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            {(Object.keys(ringkas) as (StatusAbsen | 'belum')[])
              .filter((s) => s !== 'belum' || !selesai)
              .map((s) => (
                <span key={s} className={`badge ${s === 'belum' ? 'bg-slate-200 text-slate-700' : WARNA_STATUS[s]}`}>
                  {s === 'belum' ? 'Belum absen' : LABEL_STATUS[s]}: {ringkas[s]}
                </span>
              ))}
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Foto</th><th className="th">Nama</th><th className="th">Kelas</th><th className="th">Status</th>
                  <th className="th">Jam</th><th className="th">Dipindai oleh</th><th className="th">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {baris.map((b) => (
                  <tr key={b.id}>
                    <td className="td">
                      {b.foto ? (
                        <a href={b.foto} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={b.foto} alt="Foto bukti" className="h-12 w-12 rounded-lg object-cover" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="td"><div className="font-semibold">{b.nama}</div><div className="text-xs text-slate-500">{b.nisn}</div></td>
                    <td className="td">{b.kelas}</td>
                    <td className="td">
                      <span className={`badge ${b.status === 'belum' ? 'bg-slate-200 text-slate-700' : WARNA_STATUS[b.status]}`}>
                        {b.status === 'belum' ? 'Belum absen' : LABEL_STATUS[b.status]}
                      </span>
                    </td>
                    <td className="td">{b.jam}</td>
                    <td className="td">{b.guru}</td>
                    <td className="td text-xs text-slate-500">{b.metode !== '-' ? b.metode.replace('_', ' ') : ''}{b.catatan ? ` • ${b.catatan}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!baris.length && <p className="p-4 text-sm text-slate-500">Tidak ada data yang cocok.</p>}
          </div>
        </>
      )}

      <details className="card">
        <summary className="cursor-pointer font-bold">+ Input atau koreksi absensi manual</summary>
        <form action={absensiManual} className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><label className="label">NISN siswa</label><input name="nisn" className="input" required inputMode="numeric" /></div>
          <div>
            <label className="label">Kegiatan</label>
            <select name="kegiatan" className="input" defaultValue={kegiatan}>
              <option value="zuhur">Salat Zuhur</option><option value="wirid">Wirid Remaja</option>
            </select>
          </div>
          <div><label className="label">Tanggal</label><input name="tanggal" type="date" className="input" defaultValue={tanggal} required /></div>
          <div>
            <label className="label">Status</label>
            <select name="status" className="input" defaultValue="hadir">
              {(Object.keys(LABEL_STATUS) as StatusAbsen[]).map((s) => <option key={s} value={s}>{LABEL_STATUS[s]}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label className="label">Alasan (wajib)</label><input name="alasan" className="input" required minLength={3} placeholder="Contoh: HP siswa rusak, diabsen manual oleh guru" /></div>
          <div className="sm:col-span-3"><button className="btn-primary">Simpan</button></div>
        </form>
      </details>

      <div className="card flex flex-wrap items-end gap-3">
        <form method="get" action="/api/admin/export" className="flex flex-wrap items-end gap-3">
          <div><label className="label">Ekspor dari</label><input type="date" name="dari" defaultValue={awalBulan(now.tanggal)} className="input" /></div>
          <div><label className="label">Sampai</label><input type="date" name="sampai" defaultValue={now.tanggal} className="input" /></div>
          <button className="btn-outline">Unduh Excel (data penelitian)</button>
        </form>
      </div>
    </div>
  );
}
