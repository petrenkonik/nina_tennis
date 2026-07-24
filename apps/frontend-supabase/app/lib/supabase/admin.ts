import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role клиент Supabase: обходит RLS.
 *
 * ТОЛЬКО для серверного кода (Server Actions, Route Handlers, next-auth callbacks,
 * seed-скрипт). Никогда не импортировать в Client Components и не экспортировать
 * через NEXT_PUBLIC_*. Здесь роль проверяется серверным кодом (permissions.ts),
 * а не RLS — это зеркальный перенос NestJS-гардов.
 *
 * Lazy-инициализация: клиент создаётся при первом обращении, а не на этапе импорта.
 * Это нужно, чтобы Next.js мог собрать страницу без env-переменных (они появятся
 * только в рантайме). Ошибка бросается при реальном использовании без ключей.
 */

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase service-role env missing: требуется SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY. ' +
        'См. .env.local.example',
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/**
 * Геттер вместо прямого экспорта клиента.
 * Использование: `const sb = await supabaseAdmin();` или `supabaseAdmin().from(...)`.
 *
 * Реализован как Proxy, чтобы сохранить удобный API `supabaseAdmin.from(...)`
 * с ленивым созданием клиента под капотом.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
}) as SupabaseClient;
