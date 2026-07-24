'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Браузерный клиент Supabase (publishable/anon-ключ).
 *
 * Используется для:
 *  - прямого публичного чтения (турниры, матчи, игроки — RLS разрешает SELECT),
 *  - подписок Realtime на таблицу matches (live-табло, судейство).
 *
 * Мутации через него НЕ идут — все записи выполняются Server Actions с admin-клиентом.
 *
 * Поддерживаем оба именования ключа:
 *  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (новый формат Supabase, sb_publishable_*)
 *  - NEXT_PUBLIC_SUPABASE_ANON_KEY (старый формат, eyJ...*)
 */
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  publishableKey!,
);
