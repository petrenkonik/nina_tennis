-- ============================================================================
-- nina_tennis — serverless (Supabase Postgres)
-- Миграция 0002: переход на нативный Supabase Auth
-- ----------------------------------------------------------------------------
-- Цель: profiles привязан к auth.users, пароли убраны из приложения.
-- auth.uid() работает в RLS → мутации идут безопасно через publishable-ключ,
-- service-role (secret) ключ в приложении больше не нужен.
--
-- ПРЕДПОСЫЛКА: миграция 0001 уже применена.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles: привязка к auth.users, убираем password_hash
-- ----------------------------------------------------------------------------
-- Снимаем NOT NULL с password_hash перед удалением (на случай строк без пароля).
alter table public.profiles alter column password_hash drop not null;
alter table public.profiles drop column password_hash;

-- Делаем id внешним ключом на auth.users (каскадное удаление вместе с пользователем).
-- Сначала убираем default gen_random_uuid() — id теперь задаёт Supabase Auth.
alter table public.profiles alter column id drop default;
alter table public.profiles
  drop constraint if exists profiles_id_fkey;
alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- Email теперь берётся из auth.users, но оставляем копию в profiles для удобства чтения
-- (не unique-ограничение — единственный источник истины email в auth.users).
alter table public.profiles alter column email drop not null;

-- ----------------------------------------------------------------------------
-- 2. Триггер: автоматическое создание profile при регистрации в auth.users
-- ----------------------------------------------------------------------------
-- Правило «первый пользователь = admin» сохранено (перенесено из приложения).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, first_name, last_name)
  values (
    new.id,
    new.email,
    -- первый пользователь становится admin
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'user' end,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. Вспомогательные функции для RLS
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_referee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'referee'
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. RLS: политики на запись (SELECT публичный остаётся из миграции 0001)
-- ----------------------------------------------------------------------------
-- profiles: свой профиль или админ (замена старой using(false))
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_read_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

--clubs / players / tournaments / groups / group_players / group_seeds / match_judges:
-- только админ может мутировать справочники и структуру.
create policy "clubs_admin_write" on public.clubs
  for all using (public.is_admin()) with check (public.is_admin());

create policy "players_admin_write" on public.players
  for all using (public.is_admin()) with check (public.is_admin());

create policy "tournaments_admin_write" on public.tournaments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "groups_admin_write" on public.groups
  for all using (public.is_admin()) with check (public.is_admin());

create policy "group_players_admin_write" on public.group_players
  for all using (public.is_admin()) with check (public.is_admin());

create policy "group_seeds_admin_write" on public.group_seeds
  for all using (public.is_admin()) with check (public.is_admin());

create policy "match_judges_admin_write" on public.match_judges
  for all using (public.is_admin()) with check (public.is_admin());

-- matches: админ — всё; судья — обновление (судейство) если может судить этот матч
create policy "matches_admin_all" on public.matches
  for all using (public.is_admin()) with check (public.is_admin());

create policy "matches_referee_update" on public.matches
  for update using (
    not public.is_admin() and public.can_user_judge_match(id, auth.uid())
  )
  with check (
    not public.is_admin() and public.can_user_judge_match(id, auth.uid())
  );

-- tournament_referees: админ добавляет/удаляет; пользователь принимает инвайт (вставка себя)
create policy "tournament_referees_admin_all" on public.tournament_referees
  for all using (public.is_admin()) with check (public.is_admin());

create policy "tournament_referees_self_accept" on public.tournament_referees
  for insert with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. Storage: аватары — запись авторизованным (politics из 0001 уже есть),
-- но обновим: запись доступна админу или аутентифицированному.
-- Политики из 0001 (public_read / authed_write) остаются рабочими.
-- ----------------------------------------------------------------------------
