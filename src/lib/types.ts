export type Role = 'siswa' | 'guru' | 'admin';
export type StatusAkun = 'menunggu' | 'aktif' | 'ditolak' | 'nonaktif';
export type Kegiatan = 'zuhur' | 'wirid';
export type StatusAbsen = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'haid' | 'alfa';

export interface Profile {
  id: string;
  role: Role;
  status: StatusAkun;
  nama: string;
  email: string;
  no_hp: string | null;
  foto_path: string | null;
  reject_reason: string | null;
}

export const LABEL_KEGIATAN: Record<Kegiatan, string> = {
  zuhur: 'Salat Zuhur',
  wirid: 'Wirid Remaja',
};

export const LABEL_STATUS: Record<StatusAbsen, string> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  haid: 'Haid',
  alfa: 'Alfa',
};

export const WARNA_STATUS: Record<StatusAbsen, string> = {
  hadir: 'bg-emerald-100 text-emerald-800',
  terlambat: 'bg-amber-100 text-amber-800',
  izin: 'bg-sky-100 text-sky-800',
  sakit: 'bg-indigo-100 text-indigo-800',
  haid: 'bg-pink-100 text-pink-800',
  alfa: 'bg-red-100 text-red-800',
};
