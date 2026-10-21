# Absensi Salat Zuhur dan Wirid Remaja

Aplikasi web presensi salat Zuhur dan wirid remaja untuk SMKN 1 Ranah Ampek Hulu Tapan.
Dibangun dengan **Next.js (TypeScript) + Supabase**, dihosting gratis di **Vercel**.

## Fitur

| Peran | Yang bisa dilakukan |
|---|---|
| Siswa | Daftar dengan data lengkap, login, **Ambil Absen** (pilih Zuhur atau Wirid, QR muncul), **Minta Izin** (sakit, izin, haid khusus perempuan), cetak Kartu QR, chatbot notifikasi |
| Guru | Daftar (perlu persetujuan admin), login, **Scanner QR** untuk memindai siswa (semua guru bisa, siswa bebas memilih guru mana saja) |
| Admin | Dashboard, Scanner, verifikasi akun, buat akun manual, reset sandi, setujui izin, pantau hadir dan alfa, input manual, master data (jadwal, kelas), log aktivitas, ekspor Excel |

Aturan jadwal bawaan (bisa diubah admin di menu Master Data):
- **Zuhur**: Senin sampai Kamis. Dibuka 12.00, tepat waktu sampai 12.30, terlambat sampai 13.00, lewat 13.00 tidak bisa absen (Alfa). Jumat, Sabtu, Minggu tidak ada kegiatan.
- **Wirid**: dua kali sebulan. Tanggal dan jamnya diisi admin.
- Scan: foto siswa otomatis tertangkap, suara konfirmasi, jeda 1 detik, lalu notifikasi masuk ke chatbot siswa.

## Langkah pemasangan (sekitar 20 menit)

### 1. Buat proyek Supabase
1. Daftar di https://supabase.com lalu **New project** (catat kata sandi database, simpan baik-baik).
2. Buka **SQL Editor > New query**, tempel seluruh isi file `supabase/schema.sql`, klik **Run**.
   Ini membuat semua tabel, aturan keamanan, bucket foto, dan data awal (jadwal Zuhur dan contoh kelas).
3. Buka **Project Settings > API**, salin: `Project URL`, `anon public key`, dan `service_role key`.
   **service_role key itu rahasia.** Jangan dibagikan, jangan di-commit ke GitHub.

### 2. Jalankan di komputer sendiri
```bash
npm install
cp .env.example .env.local      # di Windows: copy .env.example .env.local
```
Isi `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` dari langkah 1.
- `QR_SECRET`: string acak minimal 32 karakter (misalnya hasil `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAMA` untuk akun admin pertama.
- `GEMINI_API_KEY` (opsional) untuk chatbot AI. Kosongkan jika belum ada, chatbot tetap menjawab dari data absensi.

Lalu:
```bash
npm run seed:admin    # membuat akun admin
npm run dev           # buka http://localhost:3000
```
Kamera bisa dipakai di `localhost`. Di perangkat lain, kamera hanya jalan lewat HTTPS (otomatis ada di Vercel).

### 3. Hosting gratis di Vercel
1. Unggah proyek ke GitHub (file `.env.local` otomatis tidak ikut karena ada di `.gitignore`).
2. Di https://vercel.com pilih **Add New > Project**, impor repositori.
3. Di **Environment Variables**, isi semua variabel dari `.env.example` (kecuali `ADMIN_*`).
4. **Deploy**. Hasilnya tautan `https://nama-proyek.vercel.app` yang bisa dibagikan ke siswa dan guru.
   Siswa bisa memilih "Tambahkan ke layar utama" di peramban HP agar seperti aplikasi.

### 4. Pengaturan awal setelah login admin
1. **Master Data**: periksa jam Zuhur, ganti contoh kelas dengan kelas sebenarnya, isi dua tanggal wirid bulan ini.
2. Bagikan tautan ke guru dan siswa untuk mendaftar. Setujui akun mereka di **Verifikasi Akun**.

## Daftar uji (urutkan supaya mudah melacak error)

Kerjakan berurutan. Jika satu langkah gagal, berhenti dan laporkan nomor langkahnya.

1. `npm run build` selesai tanpa error.
2. Buka `/login`, masuk sebagai admin, dashboard tampil.
3. Master Data: simpan jadwal Zuhur, tambah satu kelas, tambah satu tanggal wirid.
4. Buka `/daftar/siswa` (jendela lain), daftar satu siswa. Di admin > Verifikasi Akun, setujui.
5. Siswa login, dashboard hanya ada dua menu: Ambil Absen dan Minta Izin.
6. Daftar satu guru, setujui, guru login dan hanya melihat Scanner.
7. Siswa > Ambil Absen > Salat Zuhur: QR muncul (hari Senin sampai Kamis, mulai 12.00 WIB; untuk uji di luar jam, ubah jam di Master Data).
8. Guru > Scanner > Mulai Scanner, izinkan kamera, pindai QR siswa: terdengar suara, foto tertangkap, status tampil.
9. Siswa melihat notifikasi muncul di ikon chat tanpa memuat ulang halaman.
10. Pindai QR yang sama lagi: ditolak "sudah tercatat".
11. Siswa > Minta Izin: kirim, admin > Izin > Setujui, status siswa jadi Izin atau Sakit di Kehadiran.
12. Admin > Kehadiran: foto, status, dan nama guru pemindai tampil. Unduh Excel.
13. Siswa > Kartu QR > Cetak, pindai kartu dengan scanner.
14. Chatbot: tanya "berapa kali aku alfa bulan ini?".

## Catatan penting

- **Penyimpanan foto di paket gratis terbatas.** Foto dikecilkan otomatis (sekitar 480 px). Gunakan **Master Data > Perawatan penyimpanan foto** untuk menghapus foto lama secara berkala (disarankan 14 sampai 30 hari). Data absensi tetap tersimpan.
- Proyek Supabase gratis bisa **tidur** jika lama tidak dipakai (misalnya libur panjang). Aktifkan kembali dari dashboard Supabase.
- Cek batas paket gratis Supabase dan Vercel terbaru di situs resmi masing-masing sebelum uji coba dengan banyak siswa.
- **Foto siswa adalah data pribadi anak.** Minta izin sekolah dan persetujuan orang tua atau wali sebelum dipakai.
- Batas "tepat waktu" Zuhur bawaan adalah 12.30. Ubah di Master Data bila perlu.
- Kunci `SUPABASE_SERVICE_ROLE_KEY`, `QR_SECRET`, dan `GEMINI_API_KEY` hanya ada di server. Jangan beri awalan `NEXT_PUBLIC_`.
- Lupa kata sandi: admin mengatur ulang di **Kelola Akun**.

## Struktur proyek

```
supabase/schema.sql         skema database, keamanan (RLS), bucket, data awal
scripts/seed-admin.mjs      membuat akun admin pertama
src/lib/                    jadwal.ts (aturan jam), qr.ts (token QR), chatbot.ts, akun.ts, auth.ts
src/components/             QrScanner, QrDisplay, KartuQr, ChatWidget, form
src/app/siswa|guru|admin    halaman per peran
src/app/api/                scan, izin, chat, qr, ekspor, registrasi
```

## Cara kerja QR (ringkas)
- QR di layar siswa: token bertanda tangan server, mengikat siswa, kegiatan, dan tanggal, berlaku 60 detik dan diperbarui otomatis. Tangkapan layar yang dikirim ke teman cepat kedaluwarsa.
- Kartu QR cetak: token tetap, tapi wajib disertai foto saat dipindai.
- Satu siswa hanya punya satu catatan per kegiatan per hari.
- Alfa tidak disimpan, tetapi dihitung dari siswa aktif yang tidak punya catatan setelah jam tutup, hanya pada hari kegiatan.
