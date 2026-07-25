import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Серверный клиент Supabase: читает сессию Supabase Auth из cookies (@supabase/ssr).
 * Используется в Server Components и Server Actions. auth.uid() работает в RLS →
 * мутации безопасны через publishable-ключ + политики RLS.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll вызывается middleware/Server Component при отсутствии доступа
            // на запись cookies — безопасно игнорируем в режиме только-чтение.
          }
        },
      },
    },
  );
}
