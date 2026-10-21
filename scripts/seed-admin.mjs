// Membuat akun admin pertama. Jalankan: npm run seed:admin
// Membaca ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAMA dari .env.local
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function muatEnv(file) {
  if (!existsSync(file)) return;
  for (const baris of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
muatEnv('.env.local');
muatEnv('.env');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const nama = process.env.ADMIN_NAMA || 'Administrator';

if (!url || !key || !email || !password) {
  console.error('Lengkapi NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD di .env.local');
  process.exit(1);
}
if (password.length < 8) {
  console.error('ADMIN_PASSWORD minimal 8 karakter.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let userId;
const { data: dibuat, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  if (/already|registered|exists/i.test(error.message)) {
    const { data: daftar } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const ada = daftar?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!ada) {
      console.error('Email sudah terdaftar tetapi pengguna tidak ditemukan:', error.message);
      process.exit(1);
    }
    userId = ada.id;
    await sb.auth.admin.updateUserById(userId, { password });
    console.log('Akun auth sudah ada, kata sandi diperbarui.');
  } else {
    console.error('Gagal membuat akun:', error.message);
    process.exit(1);
  }
} else {
  userId = dibuat.user.id;
}

const { error: e2 } = await sb.from('profiles').upsert({
  id: userId,
  role: 'admin',
  status: 'aktif',
  nama,
  email,
  approved_at: new Date().toISOString(),
});
if (e2) {
  console.error('Gagal menyimpan profil admin (sudah menjalankan schema.sql?):', e2.message);
  process.exit(1);
}
console.log(`Admin siap. Login dengan ${email}`);
