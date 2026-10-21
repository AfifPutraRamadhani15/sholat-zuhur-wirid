import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Absensi Zuhur dan Wirid',
    short_name: 'Absensi',
    description: 'Presensi salat Zuhur dan wirid remaja SMKN 1 Ranah Ampek Hulu Tapan',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#047857',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
