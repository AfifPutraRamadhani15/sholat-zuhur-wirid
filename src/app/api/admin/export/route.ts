import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { apiProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { awalBulan, daftarKegiatan, formatJamWIB, nowWIB } from '@/lib/jadwal';
import { LABEL_KEGIATAN, LABEL_STATUS, type StatusAbsen } from '@/lib/types';
import { satu } from '@/lib/util';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const admin = await apiProfile(['admin']);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const url = new URL(req.url);
  const now = nowWIB();
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const dari = re.test(url.searchParams.get('dari') ?? '') ? (url.searchParams.get('dari') as string) : awalBulan(now.tanggal);
  const sampai = re.test(url.searchParams.get('sampai') ?? '') ? (url.searchParams.get('sampai') as string) : now.tanggal;

  const sb = supabaseAdmin();
  const hk = (await daftarKegiatan(sb, dari, sampai)).filter((h) => h.selesai);
  const [{ data: siswa }, { data: absen }] = await Promise.all([
    sb
      .from('profiles')
      .select('id,nama,siswa_detail(nisn,kelas:kelas_id(nama,kelompok_penelitian))')
      .eq('role', 'siswa')
      .eq('status', 'aktif')
      .order('nama'),
    sb
      .from('absensi')
      .select('*,scanner:profiles!absensi_scanner_id_fkey(nama)')
      .gte('tanggal', dari)
      .lte('tanggal', sampai),
  ]);
  const peta = new Map((absen ?? []).map((a) => [`${a.siswa_id}|${a.tanggal}|${a.kegiatan}`, a]));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistem Absensi Zuhur dan Wirid';
  const sh = wb.addWorksheet('Kehadiran');
  sh.columns = [
    { header: 'Tanggal', key: 'tanggal', width: 12 },
    { header: 'Kegiatan', key: 'kegiatan', width: 14 },
    { header: 'NISN', key: 'nisn', width: 14 },
    { header: 'Nama', key: 'nama', width: 28 },
    { header: 'Kelas', key: 'kelas', width: 14 },
    { header: 'Kelompok penelitian', key: 'kelompok', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Jam scan (WIB)', key: 'jam', width: 14 },
    { header: 'Metode', key: 'metode', width: 12 },
    { header: 'Dipindai oleh', key: 'guru', width: 22 },
    { header: 'Latensi notifikasi (ms)', key: 'latensi', width: 22 },
  ];
  sh.getRow(1).font = { bold: true };
  sh.views = [{ state: 'frozen', ySplit: 1 }];

  const ringkas = new Map<string, { nisn: string; nama: string; kelas: string; kelompok: string; total: number } & Record<StatusAbsen, number>>();

  for (const s of siswa ?? []) {
    const sd = satu(s.siswa_detail as { nisn: string; kelas: unknown } | { nisn: string; kelas: unknown }[]);
    const k = satu(sd?.kelas as { nama: string; kelompok_penelitian: string | null } | { nama: string; kelompok_penelitian: string | null }[] | undefined);
    ringkas.set(s.id, {
      nisn: sd?.nisn ?? '', nama: s.nama, kelas: k?.nama ?? '', kelompok: k?.kelompok_penelitian ?? '',
      total: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, haid: 0, alfa: 0,
    });
    for (const h of hk) {
      const a = peta.get(`${s.id}|${h.tanggal}|${h.kegiatan}`);
      const status = (a?.status ?? 'alfa') as StatusAbsen;
      const r = ringkas.get(s.id)!;
      r.total += 1;
      r[status] += 1;
      sh.addRow({
        tanggal: h.tanggal,
        kegiatan: LABEL_KEGIATAN[h.kegiatan],
        nisn: sd?.nisn ?? '',
        nama: s.nama,
        kelas: k?.nama ?? '',
        kelompok: k?.kelompok_penelitian ?? '',
        status: LABEL_STATUS[status],
        jam: a ? formatJamWIB(a.scanned_at) : '',
        metode: a?.metode ?? '',
        guru: satu(a?.scanner as { nama: string } | { nama: string }[] | undefined)?.nama ?? '',
        latensi: a?.latency_ms ?? '',
      });
    }
  }

  const rs = wb.addWorksheet('Ringkasan per siswa');
  rs.columns = [
    { header: 'NISN', key: 'nisn', width: 14 },
    { header: 'Nama', key: 'nama', width: 28 },
    { header: 'Kelas', key: 'kelas', width: 14 },
    { header: 'Kelompok penelitian', key: 'kelompok', width: 20 },
    { header: 'Total kegiatan', key: 'total', width: 14 },
    { header: 'Hadir', key: 'hadir', width: 8 },
    { header: 'Terlambat', key: 'terlambat', width: 10 },
    { header: 'Izin', key: 'izin', width: 8 },
    { header: 'Sakit', key: 'sakit', width: 8 },
    { header: 'Haid', key: 'haid', width: 8 },
    { header: 'Alfa', key: 'alfa', width: 8 },
    { header: '% hadir tepat waktu', key: 'pTepat', width: 20 },
    { header: '% hadir (tepat + terlambat)', key: 'pHadir', width: 26 },
  ];
  rs.getRow(1).font = { bold: true };
  for (const r of ringkas.values()) {
    rs.addRow({
      ...r,
      pTepat: r.total ? Math.round((r.hadir / r.total) * 1000) / 10 : '',
      pHadir: r.total ? Math.round(((r.hadir + r.terlambat) / r.total) * 1000) / 10 : '',
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  await audit(admin.id, 'ekspor_data', 'absensi', { dari, sampai });
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="absensi_${dari}_sd_${sampai}.xlsx"`,
    },
  });
}
