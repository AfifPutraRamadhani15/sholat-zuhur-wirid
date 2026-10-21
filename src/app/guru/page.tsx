import QrScanner from '@/components/QrScanner';

export default function GuruHome() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Scanner QR</h1>
        <p className="text-sm text-slate-600">
          Pindai QR siswa untuk mencatat absen Zuhur atau Wirid. Siswa boleh dipindai guru mana saja.
        </p>
      </div>
      <QrScanner />
    </div>
  );
}
