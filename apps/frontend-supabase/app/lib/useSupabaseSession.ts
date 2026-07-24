'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabaseBrowser } from './supabase/browser';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface SupabaseSession {
  /** Текущий пользователь (id/email) или null. */
  user: { id: string; email: string } | null;
  /** Роль из profiles: 'admin' | 'user' | 'referee'. */
  role: string | null;
  status: SessionStatus;
}

/**
 * Клиентский хук сессии Supabase Auth. Замена next-auth useSession().
 *
 * Возвращает { user, role, status }. Роль тянется из profiles отдельным запросом,
 * т.к. Supabase не кладёт её в стандартный User-объект.
 *
 * Реагирует на изменения состояния аутентификации (вход/выход) через onAuthStateChange.
 */
export function useSupabaseSession(): SupabaseSession {
  const [session, setSession] = useState<SupabaseSession>({
    user: null,
    role: null,
    status: 'loading',
  });

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser();
    if (!user) {
      setSession({ user: null, role: null, status: 'unauthenticated' });
      return;
    }
    // Роль — из profiles (RLS разрешает читать свой профиль).
    const { data: profile } = await supabaseBrowser
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    setSession({
      user: { id: user.id, email: user.email || '' },
      role: profile?.role || 'user',
      status: 'authenticated',
    });
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange(() => {
      load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  return session;
}
