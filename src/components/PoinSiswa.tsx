import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { daftarKegiatan, formatJamWIB, nowWIB, tambahHari } from '@/lib/jadwal';
import { LABEL_KEGIATAN, LABEL_STATUS, type Kegiatan, type StatusAbsen } from '@/lib/types';
import { satu } from '@/lib/util';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Baris = any;

async function semua(
  buat: (dari: number, sampai: number) => PromiseLike<{ data: Baris[] | null; error: unknown }>,
): Promise<Baris[]> {
  const out: Baris[] = [];
  for (let i = 0; i < 30; i++) {
    const { data, error } = await buat(i * 1000, i * 1000 + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export default async function PoinSiswa() {
  const user = await requireRole(['siswa']);
  const sb = supabaseAdmin();
  const now = nowWIB();
  const dari = tambahHari(now.tanggal, -90);

  const [siswa, absen, hk] = await Promise.all([
    semua((a, b) =>
      sb.from('profiles').select('id,nama,siswa_detail(kelas:kelas_id(nama))').eq('role', 'siswa').eq('status', 'aktif').order('id').range(a, b),
    ),
    semua((a, b) =>
      sb.from('absensi').select('siswa_id,tanggal,kegiatan,status,poin,scanned_at,foto_path').gte('tanggal', dari).order('id').range(a, b),
    ),
    daftarKegiatan(sb, dari, now.tanggal),
  ]);

  const selesai = hk.filter((h) => h.selesai);
  const per = new Map<string, Baris[]>();
  for (const r of absen) {
    const l = per.get(r.siswa_id);
    if (l) l.push(r);
    else per.set(r.siswa_id, [r]);
  }

  const rekap = siswa.map((s: Baris) => {
    const rows = per.get(s.id) ?? [];
    let poin = 0;
    let hadir = 0;
    let alfa = 0;
    let wajib = 0;
    let awal = '';
    const ada = new Set<string>();
    for (const r of rows) {
      ada.add(`${r.tanggal}|${r.kegiatan}`);
      if (!awal || r.tanggal < awal) awal = r.tanggal;
      if (r.status === 'hadir' || r.status === 'terlambat') {
        hadir += 1;
        wajib += 1;
        poin += r.poin ?? 0;
      } else if (r.status === 'alfa') {
        alfa += 1;
        wajib += 1;
        poin -= 1;
      }
    }
    // hari kegiatan yang sudah lewat dan tidak ada catatan = tidak hadir, poin -1
    if (awal) {
      for (const h of selesai) {
        if (h.tanggal >= awal && !ada.has(`${h.tanggal}|${h.kegiatan}`)) {
          alfa += 1;
          wajib += 1;
          poin -= 1;
        }
      }
    }
    const kelas = satu(satu(s.siswa_detail)?.kelas)?.nama ?? '';
    return {
      id: s.id as string,
      nama: s.nama as string,
      kelas: kelas as string,
      poin,
      alfa,
      skor: wajib ? Math.round((hadir / wajib) * 100) : 100,
    };
  });
  rekap.sort((a: { poin: number; nama: string }, b: { poin: number; nama: string }) => b.poin - a.poin || a.nama.localeCompare(b.nama));

  const idx = rekap.findIndex((r: { id: string }) => r.id === user.id);
  const saya = idx >= 0 ? rekap[idx] : null;
  const top3 = rekap.slice(0, 3);

  const hariIni = (per.get(user.id) ?? []).filter((r) => r.tanggal === now.tanggal);
  const foto = new Map<string, string>();
  for (const a of hariIni) {
    if (!a.foto_path) continue;
    const { data } = await sb.storage.from('bukti-absensi').createSignedUrl(a.foto_path, 3600);
    if (data?.signedUrl) foto.set(a.kegiatan, data.signedUrl);
  }

  return (
    <div className="space-y-4">
      {hariIni.map((a) => (
        <div key={a.kegiatan} className="card flex items-center gap-3">
          {foto.get(a.kegiatan) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto.get(a.kegiatan)} alt="Bukti scan" className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-100 text-xs text-slate-400">foto</div>
          )}
          <div>
            <div className="font-bold text-emerald-700">
              ✓ Sudah absen {LABEL_KEGIATAN[a.kegiatan as Kegiatan]} • {LABEL_STATUS[a.status as StatusAbsen]}
            </div>
            <div className="text-sm text-slate-700">
              Pukul {formatJamWIB(a.scanned_at)} WIB • +{a.poin ?? 0} poin
            </div>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold">{saya?.skor ?? 100}%</div>
          <div className="text-xs text-slate-500">Skor hadir</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold">{saya?.poin ?? 0}</div>
          <div className="text-xs text-slate-500">Poin</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold">#{idx >= 0 ? idx + 1 : '-'}</div>
          <div className="text-xs text-slate-500">dari {rekap.length}</div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-bold">🏆 Peringkat Poin Tertinggi</h2>
        {top3.map((t: { id: string; nama: string; kelas: string; poin: number }, i: number) => (
          <div
            key={t.id}
            className={`mt-2 flex items-center justify-between rounded-xl p-3 ${i === 0 ? 'bg-amber-50' : 'bg-slate-50'} ${t.id === user.id ? 'ring-2 ring-emerald-400' : ''}`}
          >
            <span className="font-semibold">
              {['🥇', '🥈', '🥉'][i]} {t.nama} <small className="font-normal text-slate-500">{t.kelas}</small>
            </span>
            <b>{t.poin}</b>
          </div>
        ))}
      </div>

      <div className="card text-sm text-slate-600">
        <b>Cara dapat poin:</b> hadir tepat waktu +10, ditambah bonus sampai +5 kalau scan cepat setelah jam buka. Terlambat +5. Tidak
        absen pada hari kegiatan <b>−1 poin per hari</b>. Izin, sakit, dan haid tidak mengurangi poin.
        {saya && saya.alfa > 0 && <div className="mt-1 text-red-600">Kamu tidak absen {saya.alfa} kali, jadi poinmu berkurang.</div>}
      </div>
    </div>
  );
}