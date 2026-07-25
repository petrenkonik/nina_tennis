import { createSupabaseServer } from './supabase/server';

/**
 * Доменный тип пользователя. Сохранён таким же, как при next-auth, чтобы
 * permissions.ts и Server Actions не менялись.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'referee';
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Текущий авторизованный пользователь на сервере (Server Actions / Route Handlers).
 * Читает сессию Supabase Auth через cookies (@supabase/ssr), затем подтягивает
 * роль и имя из profiles. Замена getServerSession(authOptions) из next-auth.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email || '',
    role: (profile?.role as AuthUser['role']) || 'user',
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
  };
}
