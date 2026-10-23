import type { Metadata, Viewport } from 'next';
import './globals.css';
import OtoKeluar from '@/components/OtoKeluar';

export const metadata: Metadata = {
  title: 'Absensi Zuhur dan Wirid',
  description: 'Sistem presensi salat Zuhur dan wirid remaja SMKN 1 Ranah Ampek Hulu Tapan',
  applicationName: 'Absensi Zuhur dan Wirid',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Absensi', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#047857',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        {children}
        <OtoKeluar />
      </body>
    </html>
  );
}