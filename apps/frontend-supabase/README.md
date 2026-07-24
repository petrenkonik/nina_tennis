# frontend-supabase

Serverless-версия приложения «Теннисные турниры» на **Supabase + Next.js (Route Handlers/Server Actions)**.

Параллельная (новая) версия; классический NestJS+MongoDB остаётся в `apps/backend` + `apps/frontend`.

## Стек

- **Frontend / API**: Next.js 15 (App Router, React 19) — Server Actions + Route Handlers заменяют NestJS.
- **БД**: Supabase Postgres (вместо MongoDB). Схема — `supabase/migrations/0001_init.sql`.
- **Auth**: next-auth (credentials-провайдер) поверх таблицы `profiles` (bcrypt). Нативный Supabase Auth — отложен.
- **Realtime**: Supabase Realtime для live-табло и судейства (вместо polling 4с).
- **Storage**: Supabase Storage (bucket `player-avatars`) для аватаров игроков.
- **Общая логика**: `libs/shared` (scoring, seeding, models) — без изменений.

## Настройка

### 1. Переменные окружения
Скопируйте `.env.local.example` → `.env.local` и заполните значениями из дашборда Supabase:
```
NEXTAUTH_URL=http://localhost:3120
NEXTAUTH_SECRET=<openssl rand -base64 32>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role>          # только сервер
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>               # браузер
```

### 2. Применить схему
Выполнить `supabase/migrations/0001_init.sql` в SQL Editor дашборда Supabase
(или `supabase db push` через Supabase CLI). Создаются таблицы, RLS, view `v_matches_full`,
RPC `can_user_judge_match`, bucket `player-avatars` и публикация Realtime.

### 3. Установка и seed
```bash
npm install
npm run seed     # демо-данные: admin/admin, клубы, 37 игроков, турниры, матчи
```

### 4. Запуск
```bash
npm run dev      # http://localhost:3120
```
Логин: `admin` / пароль: `admin`.

## Архитектура

```
app/lib/
  supabase/  server.ts (Server Components) · admin.ts (service-role, Server Actions) · browser.ts (Realtime/anon)
  auth.ts        verifyCredentials + registerUser (bcrypt по profiles)
  permissions.ts requireAdmin / assertCanJudgeMatch (замена NestJS guards)
  session.ts     getCurrentUser (getServerSession)
  api/           доменные Server Actions: tournaments, groups, matches, players, clubs, referees, users
  transform.ts   snake_case (БД) → camelCase/Mongo-стиль (UI)
  avatar.ts      клиентский модуль аватаров (Storage через Route Handler)
app/api/
  auth/[...nextauth]/route.ts   credentials-провайдер на Postgres
  players/[id]/avatar/route.ts  upload/delete аватара → Supabase Storage
```

Безопасность: публичный SELECT через RLS (турниры, матчи, игроки); все мутации — Server Actions
с service-role ключом и серверной проверкой ролей (`permissions.ts`).

## Сравнение со старой версией
| | apps/backend + apps/frontend | apps/frontend-supabase |
|---|---|---|
| Backend | NestJS 10 + MongoDB | Next.js Server Actions + Postgres |
| Auth | JWT (Passport) + next-auth/Mongo | next-auth (credentials) по profiles |
| Live | HTTP polling 4с | Supabase Realtime |
| Аватары | статика `player_photos/` | Supabase Storage |
| Деплой | 2 сервиса | 1 сервис (serverless) |
