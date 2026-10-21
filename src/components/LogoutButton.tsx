'use client';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LogoutButton({ className = 'btn-outline btn-sm' }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      className={className}
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      Keluar
    </button>
  );
}
