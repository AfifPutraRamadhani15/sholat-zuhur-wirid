import { supabaseAdmin } from '@/lib/supabase/admin';
import Flash from '@/components/Flash';
import { bersihkanFoto, hapusKelas, hapusWirid, simpanKelas, simpanWirid, simpanZuhur } from '../actions';
import { ambilPengaturanZuhur, formatTanggalID, NAMA_HARI } from '@/lib/jadwal';

export default async function Master({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sb = supabaseAdmin();
  const [z, { data: kelas }, { data: wirid }, { data: jml }] = await Promise.all([
    ambilPengaturanZuhur(sb),
    sb.from('kelas').select('*').order('nama'),
    sb.from('jadwal_wirid').select('*').order('tanggal', { ascending: false }).limit(24),
    sb.from('siswa_detail').select('kelas_id'),
  ]);
  const jumlah = new Map<string, number>();
  for (const r of jml ?? []) if (r.kelas_id) jumlah.set(r.kelas_id, (jumlah.get(r.kelas_id) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Master Data</h1>
        <p className="text-sm text-slate-600">Jadwal kegiatan, kelas, dan perawatan penyimpanan foto.</p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      <section className="card">
        <h2 className="mb-1 font-bold">Jadwal Salat Zuhur</h2>
        <p className="mb-4 text-sm text-slate-600">
          Absen dibuka pada jam buka. Sampai batas tepat waktu dihitung Hadir, setelah itu sampai batas terlambat dihitung Terlambat, dan lewat itu tidak bisa absen lagi (jadi Alfa).
        </p>
        <form action={simpanZuhur} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="label">Jam buka</label><input type="time" name="buka" defaultValue={z.buka} className="input" required /></div>
            <div><label className="label">Batas tepat waktu</label><input type="time" name="tepat" defaultValue={z.tepat} className="input" required /></div>
            <div><label className="label">Batas terlambat (tutup)</label><input type="time" name="tutup" defaultValue={z.tutup} className="input" required /></div>
          </div>
          <div>
            <div className="label">Hari kegiatan</div>
            <div className="flex flex-wrap gap-3 text-sm">
              {[1, 2, 3, 4, 5, 6, 7].map((h) => (
                <label key={h} className="flex items-center gap-1.5">
                  <input type="checkbox" name="hari" value={h} defaultChecked={z.hari.includes(h)} /> {NAMA_HARI[h]}
                </label>
              ))}
            </div>
          </div>
          <button className="btn-primary">Simpan jadwal Zuhur</button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-1 font-bold">Jadwal Wirid Remaja</h2>
        <p className="mb-4 text-sm text-slate-600">Wirid berlangsung dua kali dalam sebulan. Tambahkan tanggal dan jamnya di sini. Menambah tanggal yang sama akan memperbarui jamnya.</p>
        <form action={simpanWirid} className="mb-4 grid gap-4 sm:grid-cols-5">
          <div><label className="label">Tanggal</label><input type="date" name="tanggal" className="input" required /></div>
          <div><label className="label">Jam mulai</label><input type="time" name="jam_mulai" className="input" required /></div>
          <div><label className="label">Batas tepat waktu</label><input type="time" name="jam_tepat_waktu" className="input" required /></div>
          <div><label className="label">Batas terlambat</label><input type="time" name="jam_tutup" className="input" required /></div>
          <div><label className="label">Catatan</label><input name="catatan" className="input" placeholder="Opsional" /></div>
          <div className="sm:col-span-5"><button className="btn-primary">Simpan jadwal wirid</button></div>
        </form>
        {!wirid?.length ? (
          <p className="text-sm text-slate-500">Belum ada jadwal wirid.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {wirid.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b>{formatTanggalID(w.tanggal)}</b> • {w.jam_mulai} (tepat {w.jam_tepat_waktu}, tutup {w.jam_tutup}) {w.catatan ? `• ${w.catatan}` : ''}
                </span>
                <form action={hapusWirid}><input type="hidden" name="id" value={w.id} /><button className="btn-outline btn-sm">Hapus</button></form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-1 font-bold">Kelas</h2>
        <p className="mb-4 text-sm text-slate-600">Kelompok penelitian dipakai untuk memisahkan kelas eksperimen dan kontrol saat mengekspor data skripsi.</p>
        <form action={simpanKelas} className="mb-4 grid gap-4 sm:grid-cols-5">
          <div><label className="label">Nama kelas</label><input name="nama" className="input" required placeholder="X PPLG 1" /></div>
          <div><label className="label">Jurusan</label><input name="jurusan" className="input" /></div>
          <div><label className="label">Tingkat</label><input name="tingkat" className="input" placeholder="X" /></div>
          <div>
            <label className="label">Kelompok penelitian</label>
            <select name="kelompok_penelitian" className="input" defaultValue="">
              <option value="">Tidak ikut penelitian</option><option value="eksperimen">Eksperimen</option><option value="kontrol">Kontrol</option>
            </select>
          </div>
          <div className="flex items-end"><button className="btn-primary w-full">Tambah kelas</button></div>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Kelas</th><th className="th">Jurusan</th><th className="th">Siswa</th><th className="th">Kelompok penelitian</th><th className="th">Aksi</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {kelas?.map((k) => (
                <tr key={k.id}>
                  <td className="td font-semibold">{k.nama}</td>
                  <td className="td">{k.jurusan ?? '-'}</td>
                  <td className="td">{jumlah.get(k.id) ?? 0}</td>
                  <td className="td">
                    <form action={simpanKelas} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={k.id} />
                      <input type="hidden" name="nama" value={k.nama} />
                      <input type="hidden" name="jurusan" value={k.jurusan ?? ''} />
                      <input type="hidden" name="tingkat" value={k.tingkat ?? ''} />
                      <select name="kelompok_penelitian" defaultValue={k.kelompok_penelitian ?? ''} className="input w-44 py-1 text-xs">
                        <option value="">Tidak ikut</option><option value="eksperimen">Eksperimen</option><option value="kontrol">Kontrol</option>
                      </select>
                      <button className="btn-outline btn-sm">Simpan</button>
                    </form>
                  </td>
                  <td className="td">
                    <form action={hapusKelas}><input type="hidden" name="id" value={k.id} /><button className="btn-outline btn-sm">Hapus</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-1 font-bold">Perawatan penyimpanan foto</h2>
        <p className="mb-4 text-sm text-slate-600">
          Paket gratis punya batas penyimpanan. Hapus foto bukti yang sudah lama; data absensi tetap tersimpan, hanya fotonya yang dihapus.
        </p>
        <form action={bersihkanFoto} className="flex flex-wrap items-end gap-3">
          <div><label className="label">Hapus foto yang lebih lama dari (hari)</label><input name="hari" type="number" min={1} max={365} defaultValue={30} className="input w-40" required /></div>
          <button className="btn-danger">Hapus foto lama</button>
        </form>
      </section>
    </div>
  );
}
