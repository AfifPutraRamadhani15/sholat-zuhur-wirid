const FITUR = [
  { judul: 'Absen dengan QR', isi: 'Siswa menunjukkan QR, guru memindai. Cepat dan tanpa kertas.' },
  { judul: 'Pengingat otomatis', isi: 'Notifikasi di layar HP sebelum Zuhur dan Wirid dimulai.' },
  { judul: 'Rekap kehadiran', isi: 'Data hadir, terlambat, izin, dan alfa tersusun otomatis.' },
  { judul: 'Asisten chatbot', isi: 'Tanya jadwal dan status absen kapan saja.' },
];

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* KIRI: hanya tampil di desktop (Windows dan macOS) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/sekolah.jpg')" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-900/65 to-emerald-800/45" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-lg font-bold text-emerald-700">AZ</div>
          <div className="text-sm font-semibold leading-tight">
            Absensi Zuhur dan Wirid
            <div className="font-normal text-white/75">SMKN 1 Ranah Ampek Hulu Tapan</div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-4xl font-bold leading-tight">Absensi salat Zuhur dan wirid, lebih mudah dan tertib.</h2>
          <p className="mt-4 text-white/85">
            Satu aplikasi untuk siswa, guru, dan admin sekolah. Masuk untuk mulai mencatat dan memantau kehadiran.
          </p>
          <ul className="mt-8 space-y-4">
            {FITUR.map((f) => (
              <li key={f.judul} className="flex gap-3">
                <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white/90 text-xs font-bold text-emerald-700">✓</span>
                <span>
                  <span className="font-semibold">{f.judul}</span>
                  <span className="block text-sm text-white/80">{f.isi}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/70">SMKN 1 Ranah Ampek Hulu Tapan</p>
      </aside>

      {/* KANAN: form login (page.tsx) */}
      <div className="relative">
        {/* latar foto hanya untuk HP dan tablet */}
        <div
          aria-hidden
          className="fixed inset-0 -z-10 bg-cover bg-center lg:hidden"
          style={{ backgroundImage: "url('/sekolah.jpg')" }}
        />
        <div aria-hidden className="fixed inset-0 -z-10 bg-white/70 lg:hidden" />

        <div className="lg:min-h-screen lg:bg-white">{children}</div>
      </div>
    </div>
  );
}