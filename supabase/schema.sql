-- =====================================================================
--  Absensi Salat Zuhur dan Wirid Remaja - Skema Supabase (PostgreSQL)
--  Cara pakai: Supabase Dashboard > SQL Editor > New query > tempel semua > Run
--  Aman dijalankan ulang (memakai IF NOT EXISTS / ON CONFLICT).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- kelas
create table if not exists public.kelas (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  jurusan text,
  tingkat text,
  -- untuk penelitian skripsi: kelas eksperimen atau kontrol (boleh kosong)
  kelompok_penelitian text check (kelompok_penelitian in ('eksperimen', 'kontrol')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('siswa', 'guru', 'admin')),
  status text not null default 'menunggu' check (status in ('menunggu', 'aktif', 'ditolak', 'nonaktif')),
  nama text not null,
  email text not null,
  no_hp text,
  foto_path text,
  reject_reason text,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.siswa_detail (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  nisn text not null unique,
  nis text,
  kelas_id uuid references public.kelas (id),
  jenis_kelamin text not null check (jenis_kelamin in ('L', 'P')),
  tempat_lahir text,
  tanggal_lahir date,
  alamat text,
  nama_wali text,
  no_hp_wali text
);

create table if not exists public.guru_detail (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  nip_nuptk text,
  mapel text,
  jabatan text
);

-- -------------------------------------------------------- jadwal & aturan
-- Wirid remaja: 2 kali sebulan, tanggal dan jam diisi admin
create table if not exists public.jadwal_wirid (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null unique,
  jam_mulai text not null,
  jam_tepat_waktu text not null,
  jam_tutup text not null,
  catatan text,
  created_at timestamptz not null default now()
);

create table if not exists public.pengaturan (
  key text primary key,
  value text not null
);

-- --------------------------------------------------------------- absensi
create table if not exists public.absensi (
  id uuid primary key default gen_random_uuid(),
  siswa_id uuid not null references public.profiles (id) on delete cascade,
  kegiatan text not null check (kegiatan in ('zuhur', 'wirid')),
  tanggal date not null,
  status text not null check (status in ('hadir', 'terlambat', 'izin', 'sakit', 'haid', 'alfa')),
  scanned_at timestamptz not null default now(),
  metode text not null check (metode in ('qr_layar', 'kartu', 'manual', 'izin')),
  foto_path text,
  scanner_id uuid references public.profiles (id),
  catatan text,
  notif_sent_at timestamptz,
  latency_ms integer,
  created_at timestamptz not null default now(),
  unique (siswa_id, kegiatan, tanggal)
);
create index if not exists absensi_tanggal_idx on public.absensi (tanggal, kegiatan);
create index if not exists absensi_siswa_idx on public.absensi (siswa_id, tanggal);

-- ------------------------------------------------------------------ izin
create table if not exists public.izin (
  id uuid primary key default gen_random_uuid(),
  siswa_id uuid not null references public.profiles (id) on delete cascade,
  jenis text not null check (jenis in ('sakit', 'izin', 'haid')),
  kegiatan text not null check (kegiatan in ('zuhur', 'wirid', 'keduanya')),
  tanggal date not null,
  alasan text not null,
  lampiran_path text,
  status text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  catatan_admin text,
  created_at timestamptz not null default now()
);
create index if not exists izin_status_idx on public.izin (status, tanggal);
create index if not exists izin_siswa_idx on public.izin (siswa_id, tanggal);

-- ------------------------------------------------------- chat & audit log
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  siswa_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('bot', 'user')),
  tipe text not null default 'notifikasi' check (tipe in ('notifikasi', 'ai')),
  isi text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_siswa_idx on public.chat_messages (siswa_id, created_at desc);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  aksi text not null,
  objek text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_log (created_at desc);

-- =========================================================== keamanan (RLS)
-- Semua tabel dikunci. Aplikasi mengakses data lewat server (service role)
-- setelah memeriksa peran pengguna. Pengguna biasa hanya boleh membaca
-- profil sendiri dan pesan chat miliknya (untuk notifikasi realtime).
alter table public.kelas enable row level security;
alter table public.profiles enable row level security;
alter table public.siswa_detail enable row level security;
alter table public.guru_detail enable row level security;
alter table public.jadwal_wirid enable row level security;
alter table public.pengaturan enable row level security;
alter table public.absensi enable row level security;
alter table public.izin enable row level security;
alter table public.chat_messages enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "profil sendiri" on public.profiles;
create policy "profil sendiri" on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists "chat sendiri" on public.chat_messages;
create policy "chat sendiri" on public.chat_messages for select to authenticated using (siswa_id = auth.uid());

-- Realtime untuk notifikasi chatbot
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ================================================================ storage
-- Semua bucket privat. File hanya dibuka lewat tautan bertanda tangan dari server.
insert into storage.buckets (id, name, public)
values
  ('bukti-absensi', 'bukti-absensi', false),
  ('lampiran-izin', 'lampiran-izin', false),
  ('foto-profil', 'foto-profil', false)
on conflict (id) do nothing;

-- ============================================================= data awal
insert into public.pengaturan (key, value) values
  ('zuhur_buka', '12:00'),
  ('zuhur_tepat', '12:30'),
  ('zuhur_tutup', '13:00'),
  ('zuhur_hari', '1,2,3,4')
on conflict (key) do nothing;

-- Contoh kelas. Ubah atau tambah dari menu Master Data (admin) setelah login.
insert into public.kelas (nama, jurusan, tingkat) values
  ('X PPLG', 'PPLG', 'X'),
  ('XI PPLG', 'PPLG', 'XI'),
  ('XII PPLG', 'PPLG', 'XII')
on conflict (nama) do nothing;
