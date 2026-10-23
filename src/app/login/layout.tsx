export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/sekolah.jpg')" }}
      />
      {/* lapisan putih tipis supaya tulisan tetap terbaca */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-white/70" />
      {children}
    </>
  );
}