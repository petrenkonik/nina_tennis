import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'admin') {
      router.replace('/login');
    }
  }, [session, status, router]);

  if (status === 'loading') return <div>Загрузка...</div>;
  if (!session || session.user.role !== 'admin') return null;
  return <>{children}</>;
} 