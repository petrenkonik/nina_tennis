"use client";

import { ThemeProvider } from 'next-themes';
import React from 'react';

/**
 * Корневые провайдеры.
 * Supabase Auth не требует React-провайдера — сессия читается через cookies
 * (сервер) и supabaseBrowser.auth (клиент, см. useSupabaseSession).
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
