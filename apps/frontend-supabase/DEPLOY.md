# Деплой `frontend-supabase` на Vercel

Serverless-версия (Next.js App Router + Server Actions + Supabase). gitverse Pages
**не подходит** — он хостит только статику, а здесь серверный рендеринг, middleware
и Server Actions. Vercel поддерживает весь функционал Next.js из коробки.

## Что нужно
- Аккаунт Vercel (бесплатного тарифа Hobby достаточно).
- Репозиторий подключён к GitHub: `petrenkonik/nina_tennis`.

## Шаги в дашборде Vercel

1. **New Project → Import Git Repository** → выбрать `petrenkonik/nina_tennis`.
2. **Root Directory** = `apps/frontend-supabase` (Vercel сам подтянет `vercel.json`,
   `next.config.js`, и определит Next.js).
3. **Environment Variables** — добавить:
   | Имя | Значение |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://pnviergohcyfieskqjyt.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` (из Supabase Dashboard → Settings → API) |

   Оба значения **публичные** (publishable-ключ — публичный аналог anon; RLS защищает
   данные, а не ключ). Секретный service-role ключ **не нужен** — мутации идут через RLS
   + `auth.uid()`.
4. **Deploy.** Дальше — авто-деплой по каждому `git push` в `main`.

## Проверка сборки (локально, как делает Vercel)

```bash
cd apps/frontend-supabase
export NEXT_PUBLIC_SUPABASE_URL=https://pnviergohcyfieskqjyt.supabase.co
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
npm run build   # все 26 роутов + middleware
```

## Замечания
- `@shared/*` (логика скоринга, сетки, DTO) резолвится через `tsconfig paths`
  к `libs/shared/src/*` — Vercel клонирует весь репо, поэтому пути работают.
- Vercel CLI (если нужен деплой с машины): `npm i -g vercel && vercel` из
  `apps/frontend-supabase`.
