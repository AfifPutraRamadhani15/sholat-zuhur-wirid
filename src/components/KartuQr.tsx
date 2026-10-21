'use client';
import { QRCodeSVG } from 'qrcode.react';

export default function KartuQr({ token, nama, kelas, nisn }: { token: string; nama: string; kelas: string; nisn: string }) {
  return (
    <div>
      <div className="mx-auto w-full max-w-xs rounded-2xl border-2 border-brand-700 bg-white p-5 text-center">
        <div className="text-xs font-bold uppercase tracking-wide text-brand-800">Kartu Absensi Zuhur dan Wirid</div>
        <div className="text-[11px] text-slate-500">SMKN 1 Ranah Ampek Hulu Tapan</div>
        <div className="mx-auto my-4 w-fit">
          <QRCodeSVG value={token} size={200} level="M" marginSize={1} />
        </div>
        <div className="text-base font-bold">{nama}</div>
        <div className="text-sm text-slate-600">{kelas}</div>
        <div className="text-xs text-slate-500">NISN {nisn}</div>
      </div>
      <div className="no-print mt-5 text-center">
        <button className="btn-primary" onClick={() => window.print()}>
          Cetak kartu
        </button>
      </div>
    </div>
  );
}
