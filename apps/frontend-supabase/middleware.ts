import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware: обновление сессии Supabase Auth на каждый запрос + защита роутов.
 *
 * 1. Refresh токена (чтобы сессия не протухла в браузере).
 * 2. Защита /admin/* и /profile — редирект на /login если пользователь не авторизован.
 *    (Серверная проверка прав в Server Actions остаётся как второй слой.)
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response.cookies.set;
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Обновляем сессию (важно вызывать, чтобы токены не протухали).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Защита закрытых роутов
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith('/admin') || path.startsWith('/profile');
  const isLoginPage = path === '/login';

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // Если уже авторизован и на /login — отправляем дальше по ролям (клиент решает).
  if (user && isLoginPage) {
    // не редиректим здесь — страница login сама определит роль и редиректнет
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/profile/:path*', '/login'],
};
