export default function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (!msg && !err) return null;
  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        err ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      {err || msg}
    </div>
  );
}
