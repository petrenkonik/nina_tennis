import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { useSupabaseSession } from 'app/lib/useSupabaseSession';

/**
 * Защита клиентских разделов: пускает только админа.
 * Дополнительный слой к серверной проверке в Server Actions и middleware.
 */
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { role, status } = useSupabaseSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'authenticated' || role !== 'admin') {
      router.replace('/login');
    }
  }, [role, status, router]);

  if (status === 'loading') return <div>Загрузка...</div>;
  if (status !== 'authenticated' || role !== 'admin') return null;
  return <>{children}</>;
}
