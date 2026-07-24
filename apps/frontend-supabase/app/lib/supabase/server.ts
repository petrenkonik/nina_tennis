import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Серверный клиент Supabase для чтения в Server Components.
 * Использует anon-ключ + cookies (для будущего перехода на нативный Supabase Auth).
 *
 * Сейчас auth живёт на next-auth (JWT в cookies next-auth), поэтому этот клиент
 * работает как anon: читает публичные данные через RLS. Для мутаций и операций,
 * требующих обхода RLS, используйте supabaseAdmin из ./admin.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
