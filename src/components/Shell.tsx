import Link from 'next/link';
import LogoutButton from './LogoutButton';

export interface NavItem {
  href: string;
  label: string;
}

export default function Shell({
  nav = [],
  nama,
  peran,
  home,
  lebar = 'max-w-5xl',
  children,
}: {
  nav?: NavItem[];
  nama: string;
  peran: string;
  home: string;
  lebar?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className={`mx-auto flex ${lebar} items-center justify-between gap-3 px-4 py-3`}>
          <Link href={home} className="flex items-center gap-2 font-bold text-brand-800">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-sm text-white">AZ</span>
            <span className="hidden sm:inline">Absensi Zuhur dan Wirid</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="max-w-[10rem] truncate text-sm font-semibold">{nama}</div>
              <div className="text-xs capitalize text-slate-500">{peran}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
        {nav.length > 0 && (
          <nav className={`mx-auto flex ${lebar} gap-1 overflow-x-auto px-3 pb-2`}>
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-800"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className={`mx-auto ${lebar} px-4 py-6`}>{children}</main>
    </div>
  );
}
