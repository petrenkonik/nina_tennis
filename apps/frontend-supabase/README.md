# frontend-supabase

Serverless-версия приложения «Теннисные турниры» на **Supabase + Next.js (Route Handlers/Server Actions)**.

Параллельная (новая) версия; классический NestJS+MongoDB остаётся в `apps/backend` + `apps/frontend`.

## Стек

- **Frontend / API**: Next.js 15 (App Router, React 19) — Server Actions + Route Handlers заменяют NestJS.
- **БД**: Supabase Postgres (вместо MongoDB). Схема — `supabase/migrations/0001_init.sql` + `0002_supabase_auth.sql`.
- **Auth**: нативный Supabase Auth (email/password, `@supabase/ssr`). Роли в `profiles`, проверка прав через RLS (`auth.uid()`).
- **Realtime**: Supabase Realtime для live-табло и судейства (вместо polling 4с).
- **Storage**: Supabase Storage (bucket `player-avatars`) для аватаров игроков.
- **Общая логика**: `libs/shared` (scoring, seeding, models) — без изменений.

## Настройка

### 1. Переменные окружения
Скопируйте `.env.local.example` → `.env.local` и заполните значениями из дашборда Supabase:
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<ключ>   # браузер + сервер (RLS)
```
Secret/service-role ключ **не нужен** — все мутации идут через publishable + RLS.

### 2. Применить схему
Выполнить в SQL Editor дашборда Supabase (или `supabase db push`):
1. `supabase/migrations/0001_init.sql` — таблицы, RLS, view `v_matches_full`,
   RPC `can_user_judge_match`, bucket `player-avatars`, публикация Realtime.
2. `supabase/migrations/0002_supabase_auth.sql` — привязка `profiles` к `auth.users`,
   триггер `handle_new_user` (первый пользователь = admin), функции `is_admin/is_referee`,
   RLS-политики на запись (`auth.uid()`).

### 3. Настройка Auth
В Supabase Dashboard → Authentication → Providers → **Email** отключить
**"Confirm email"** (чтобы вход работал сразу после регистрации/seed без подтверждения).

### 4. Установка и seed
```bash
npm install
npm run seed     # демо-данные: admin@example.com/admin, клубы, 37 игроков, турниры, матчи
```

### 5. Запуск
```bash
npm run dev      # http://localhost:3120
```
Логин: `admin@example.com` / пароль: `admin`.

## Архитектура

```
app/lib/
  supabase/  server.ts (Server Actions/Components, cookies) · browser.ts (Realtime/auth client)
  permissions.ts requireAdmin / assertCanJudgeMatch (замена NestJS guards)
  session.ts     getCurrentUser (supabase.auth.getUser + profiles)
  useSupabaseSession.ts  клиентский хук сессии (замена useSession)
  api/           доменные Server Actions: tournaments, groups, matches, players, clubs, referees, users
  transform.ts   snake_case (БД) → camelCase/Mongo-стиль (UI)
  avatar.ts      клиентский модуль аватаров (Storage через Route Handler)
middleware.ts     refresh сессии + защита /admin/*, /profile
app/api/
  players/[id]/avatar/route.ts  upload/delete аватара → Supabase Storage
```

Безопасность: публичный SELECT через RLS (турниры, матчи, игроки); мутации — Server Actions
через publishable-ключ, права проверяются RLS-политиками (`auth.uid()`, `is_admin()`,
`can_user_judge_match`) + серверная проверка в `permissions.ts`. next-auth и bcrypt удалены.

## Сравнение со старой версией
| | apps/backend + apps/frontend | apps/frontend-supabase |
|---|---|---|
| Backend | NestJS 10 + MongoDB | Next.js Server Actions + Postgres |
| Auth | JWT (Passport) + next-auth/Mongo | нативный Supabase Auth |
| Live | HTTP polling 4с | Supabase Realtime |
| Аватары | статика `player_photos/` | Supabase Storage |
| Деплой | 2 сервиса | 1 сервис (serverless) |
