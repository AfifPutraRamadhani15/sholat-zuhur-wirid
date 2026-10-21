import QrScanner from '@/components/QrScanner';

export default function AdminScan() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">Scanner QR</h1>
        <p className="text-sm text-slate-600">Sama seperti scanner guru. Bisa dipakai di HP, laptop, atau perangkat lain yang punya kamera.</p>
      </div>
      <QrScanner />
    </div>
  );
}
