'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Браузерный клиент Supabase (anon-ключ).
 *
 * Используется для:
 *  - прямого публичного чтения (турниры, матчи, игроки — RLS разрешает SELECT),
 *  - подписок Realtime на таблицу matches (live-табло, судейство).
 *
 * Мутации через него НЕ идут — все записи выполняются Server Actions с admin-клиентом.
 */
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
