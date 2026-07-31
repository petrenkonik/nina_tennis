-- ============================================================================
-- nina_tennis — миграция 0003: парные турниры (doubles)
-- ============================================================================
-- Дизайн: «пара = сторона из 2 игроков», без отдельной сущности-команды.
--  * Тип турнира хранится на уровне турнира (tournaments.format).
--  * Пара существует только как членство в группе парного турнира (group_pairs).
--    Единицей турнира является КАПИТАН пары (player_a_id) — на нём держится
--    _id/seed для generateKnockoutBracket и winner_id для скоринга по сторонам.
--  * Партнёр стороны матча: player3 (сторона 1), player4 (сторона 2) — nullable.
--  * Скоринг НЕ меняется: он считает по сторонам 1/2, а не по игрокам.
--    winner_id по-прежнему = player1_id (сторона 1) или player2_id (сторона 2).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Формат турнира: singles (по умолчанию) | doubles
-- ----------------------------------------------------------------------------
alter table public.tournaments
  add column if not exists format text not null default 'singles'
  check (format in ('singles','doubles'));

comment on column public.tournaments.format is 'Формат турнира: singles (1v1) или doubles (пары 2v2)';

-- ----------------------------------------------------------------------------
-- 2) group_pairs — пары-участники группы парного турнира
--    PK по капитану: одна пара на капитана в группе (капитан не ведёт две пары).
-- ----------------------------------------------------------------------------
create table if not exists public.group_pairs (
  group_id    bigint not null references public.groups(id)   on delete cascade,
  player_a_id bigint not null references public.players(id)  on delete cascade, -- капитан / единица турнира
  player_b_id bigint not null references public.players(id)  on delete cascade, -- партнёр
  primary key (group_id, player_a_id)
);

create index if not exists idx_group_pairs_group on public.group_pairs(group_id);
create index if not exists idx_group_pairs_b     on public.group_pairs(player_b_id);

-- Партнёр не может быть капитаном той же пары.
alter table public.group_pairs
  drop constraint if exists chk_pair_distinct;
alter table public.group_pairs
  add constraint chk_pair_distinct check (player_a_id <> player_b_id);

comment on table public.group_pairs is 'Пары-участники группы парного турнира (единица турнира — капитан player_a_id)';

-- ----------------------------------------------------------------------------
-- 3) group_pair_seeds — посев пар (ключ — капитан пары)
--    Зеркало group_seeds, но для парного режима.
-- ----------------------------------------------------------------------------
create table if not exists public.group_pair_seeds (
  group_id    bigint not null references public.groups(id)  on delete cascade,
  player_a_id bigint not null references public.players(id) on delete cascade,
  seed        int not null,
  primary key (group_id, player_a_id)
);

create index if not exists idx_group_pair_seeds_group on public.group_pair_seeds(group_id);

comment on table public.group_pair_seeds is 'Посев пар группы (seed привязан к капитану пары)';

-- ----------------------------------------------------------------------------
-- 4) matches: партнёры сторон (nullable — для одиночных остаются NULL)
--    player1=капитан стороны1, player3=партнёр стороны1
--    player2=капитан стороны2, player4=партнёр стороны2
-- ----------------------------------------------------------------------------
alter table public.matches
  add column if not exists player3_id bigint references public.players(id) on delete set null,
  add column if not exists player4_id bigint references public.players(id) on delete set null;

create index if not exists idx_matches_player3 on public.matches(player3_id);
create index if not exists idx_matches_player4 on public.matches(player4_id);

comment on column public.matches.player3_id is 'Партнёр стороны 1 (для парных матчей); NULL в одиночных';
comment on column public.matches.player4_id is 'Партнёр стороны 2 (для парных матчей); NULL в одиночных';

-- ----------------------------------------------------------------------------
-- 5) VIEW v_matches_full: добавляем join партнёров сторон
--    Полностью пересоздаём view (create or replace), сохраняя все прежние поля.
-- ----------------------------------------------------------------------------
create or replace view public.v_matches_full as
select
  m.id, m.group_id, m.player1_id, m.player2_id, m.player3_id, m.player4_id,
  m.score, m.status,
  m.scheduled_at, m.played_at, m.winner_id, m.court, m.round,
  m.server_side, m.court_side_p1, m.court_side_p2,
  m.scoring_state, m.point_history, m.referee_id, m.created_at,
  g.name     as group_name,
  g.tournament_id,
  p1.full_name as player1_name, p1.photo_url as player1_photo, p1.club as player1_club,
  p2.full_name as player2_name, p2.photo_url as player2_photo, p2.club as player2_club,
  p3.full_name as player3_name, p3.photo_url as player3_photo, p3.club as player3_club,
  p4.full_name as player4_name, p4.photo_url as player4_photo, p4.club as player4_club,
  ref.email    as referee_email,
  ref.first_name as referee_first_name,
  ref.last_name  as referee_last_name
from public.matches m
left join public.groups   g  on g.id = m.group_id
left join public.players  p1 on p1.id = m.player1_id
left join public.players  p2 on p2.id = m.player2_id
left join public.players  p3 on p3.id = m.player3_id
left join public.players  p4 on p4.id = m.player4_id
left join public.profiles ref on ref.id = m.referee_id;

comment on view public.v_matches_full is 'Матч со связями (игроки, партнёры пар, судья, группа) — замена Mongo populate';

-- ----------------------------------------------------------------------------
-- 6) RLS: публичный read для новых таблиц (как у остальных турнирных данных)
-- ----------------------------------------------------------------------------
alter table public.group_pairs      enable row level security;
alter table public.group_pair_seeds enable row level security;

create policy "group_pairs_public_read" on public.group_pairs
  for select using (true);

create policy "group_pair_seeds_public_read" on public.group_pair_seeds
  for select using (true);

-- NOTE: INSERT/UPDATE/DELETE для новых таблиц намеренно отсутствуют для anon/auth.
-- Все мутации выполняются с service_role (bypass RLS) в Server Actions,
-- где роли проверяются серверным кодом (app/lib/permissions.ts).
