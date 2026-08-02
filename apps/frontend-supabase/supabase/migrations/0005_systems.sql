-- ============================================================================
-- nina_tennis — миграция 0005: системы проведения турниров
-- ============================================================================
-- Дизайн: «система проведения» — отдельная ось от формата (singles/doubles).
--  * tournaments.system: 'elimination' (сетка на вылет) | 'round_robin' (круговая).
--    По умолчанию 'elimination' (обратная совместимость со старыми турнирами).
--  * generate_group_matches ветвит по system:
--      - elimination: прежняя олимпийская сетка (snake-seeding) + при ≥4 участниках
--        создаётся один пустой матч за 3-е место (match_kind='third_place').
--      - round_robin: круговая (circle method) — каждый играет с каждым.
--  * matches.match_kind: 'normal' | 'third_place' — метка матча за 3-е место
--    (он не вписывается в бинарное дерево BracketView и рендерится отдельно).
--  * get_group_standings(p_group_id) — турнирная таблица круговой:
--    очки победа=2, поражение=1; тай-брейк мест по сетам, затем геймам.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Колонка system на турнире
-- ----------------------------------------------------------------------------
alter table public.tournaments
  add column if not exists system text not null default 'elimination'
  check (system in ('elimination','round_robin'));

comment on column public.tournaments.system is
  'Система проведения: elimination (сетка на вылет) или round_robin (каждый с каждым)';

-- ----------------------------------------------------------------------------
-- 2) Колонка match_kind на матче (метка матча за 3-е место)
-- ----------------------------------------------------------------------------
alter table public.matches
  add column if not exists match_kind text not null default 'normal'
  check (match_kind in ('normal','third_place'));

comment on column public.matches.match_kind is
  'Тип матча: normal (обычный) или third_place (матч за 3-е место в сетке)';

-- ----------------------------------------------------------------------------
-- 3) VIEW v_matches_full: добавляем match_kind
--    Полностью пересоздаём view, сохраняя все прежние поля.
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
  ref.last_name  as referee_last_name,
  m.match_kind
from public.matches m
left join public.groups   g  on g.id = m.group_id
left join public.players  p1 on p1.id = m.player1_id
left join public.players  p2 on p2.id = m.player2_id
left join public.players  p3 on p3.id = m.player3_id
left join public.players  p4 on p4.id = m.player4_id
left join public.profiles ref on ref.id = m.referee_id;

comment on view public.v_matches_full is
  'Матч со связями (игроки, партнёры пар, судья, группа) — замена Mongo populate';

-- ----------------------------------------------------------------------------
-- 4) generate_group_matches — генерация по системе турнира.
--    elimination: олимпийская сетка (snake-seeding) + матч за 3-е место.
--    round_robin: круговая (circle method) — каждый играет с каждым.
-- ----------------------------------------------------------------------------
create or replace function public.generate_group_matches(p_group_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_format text;
  v_system text;
  v_count int;
  v_total int;
  v_left int;
  v_right int;
  v_idx int;
  v_matches int;
  v_round int;
  v_k int;
  all_ids bigint[];
  slots bigint[];
  -- round-robin (circle method):
  n int;              -- размер слота (с bye, если нечётно)
  n_rounds int;       -- число раундов = n-1
  arr bigint[];       -- рабочая перестановка единиц (1-индексация)
  a_id bigint;
  b_id bigint;
  last_id bigint;
begin
  if uid is null or not public.is_admin() then
    raise exception 'Требуются права администратора' using errcode = '42501';
  end if;

  -- формат и система турнира группы (по умолчанию singles / elimination)
  select t.format, t.system into v_format, v_system
  from public.groups g
  left join public.tournaments t on t.id = g.tournament_id
  where g.id = p_group_id;
  if v_format is null then v_format := 'singles'; end if;
  if v_system is null then v_system := 'elimination'; end if;

  -- временная таблица единиц турнира (переиспользуется обеими системами)
  drop table if exists pg_temp._gmu;
  create temp table _gmu (unit_id bigint primary key, seed int, partner_id bigint) on commit drop;

  if v_format = 'doubles' then
    insert into _gmu (unit_id, seed, partner_id)
    select gp.player_a_id, gps.seed, gp.player_b_id
    from public.group_pairs gp
    left join public.group_pair_seeds gps
      on gps.group_id = gp.group_id and gps.player_a_id = gp.player_a_id
    where gp.group_id = p_group_id;
  else
    insert into _gmu (unit_id, seed, partner_id)
    select gp.player_id, gs.seed, null::bigint
    from public.group_players gp
    left join public.group_seeds gs
      on gs.group_id = gp.group_id and gs.player_id = gp.player_id
    where gp.group_id = p_group_id;
  end if;

  select count(*) into v_count from _gmu;

  -- удаляем старые матчи группы (каскадно почистит match_judges)
  delete from public.matches where group_id = p_group_id;

  if v_count = 0 then
    return;
  end if;

  -- ==========================================================================
  -- ВЕТВЬ: КРУГОВАЯ (round_robin) — circle method
  -- ==========================================================================
  if v_system = 'round_robin' then
    -- all = посеянные (по seed asc) ++ несеяные (в случайном порядке)
    select
      coalesce((select array_agg(unit_id order by seed asc) from _gmu where seed is not null), array[]::bigint[])
      || coalesce((select array_agg(unit_id order by random()) from _gmu where seed is null), array[]::bigint[])
    into all_ids;

    -- размер с bye, если участников нечётно
    n := v_count;
    if n % 2 = 1 then
      n := n + 1;
      all_ids := all_ids || array[null::bigint];   -- bye-слот
    end if;
    n_rounds := n - 1;

    -- рабочая перестановка: позиция 1 зафиксирована, вращаем позиции 2..n
    arr := all_ids;

    for v_round in 1..n_rounds loop
      for v_k in 1..(n / 2) loop
        a_id := arr[v_k];
        b_id := arr[n - v_k + 1];
        -- bye-слот → матч не создаётся
        if a_id is null or b_id is null then
          continue;
        end if;
        insert into public.matches
          (group_id, player1_id, player2_id, player3_id, player4_id, round, status, court, match_kind)
        values (
          p_group_id,
          a_id,
          b_id,
          case when v_format = 'doubles'
               then (select partner_id from _gmu where unit_id = a_id) end,
          case when v_format = 'doubles'
               then (select partner_id from _gmu where unit_id = b_id) end,
          v_round, 'scheduled', '', 'normal'
        );
      end loop;

      -- поворот: последний элемент хвоста (позиции 2..n) переходит на позицию 2
      last_id := arr[n];
      v_idx := n;
      while v_idx > 2 loop
        arr[v_idx] := arr[v_idx - 1];
        v_idx := v_idx - 1;
      end loop;
      arr[2] := last_id;
    end loop;

    return;
  end if;

  -- ==========================================================================
  -- ВЕТВЬ: НА ВЫЛЕТ (elimination) — прежняя snake-seeding + матч за 3-е место
  -- ==========================================================================
  -- all = посеянные (по seed asc) ++ несеяные (в случайном порядке)
  select
    coalesce((select array_agg(unit_id order by seed asc) from _gmu where seed is not null), array[]::bigint[])
    || coalesce((select array_agg(unit_id order by random()) from _gmu where seed is null), array[]::bigint[])
  into all_ids;

  -- total = следующая степень двойки >= v_count
  v_total := 1;
  while v_total < v_count loop
    v_total := v_total * 2;
  end loop;

  -- snake-seeding: заполняем слоты с краёв к центру
  slots := array_fill(null::bigint, array[v_total]);
  v_left := 1;
  v_right := v_total;
  v_idx := 1;
  while v_left < v_right and v_idx <= v_count loop
    slots[v_left] := all_ids[v_idx];
    v_left := v_left + 1;
    v_idx := v_idx + 1;
    if v_idx <= v_count then
      slots[v_right] := all_ids[v_idx];
      v_right := v_right - 1;
      v_idx := v_idx + 1;
    end if;
  end loop;
  if v_left = v_right and v_idx <= v_count then
    slots[v_left] := all_ids[v_idx];
  end if;

  -- раунд 1: пары подряд идущих слотов. Партнёры (для doubles) тянутся
  -- подзапросом из единиц; null-слот (BYE) корректно даёт null-игрока.
  v_matches := (v_total + 1) / 2;
  for v_k in 1..v_matches loop
    insert into public.matches
      (group_id, player1_id, player2_id, player3_id, player4_id, round, status, court)
    values (
      p_group_id,
      slots[2 * v_k - 1],
      slots[2 * v_k],
      case when v_format = 'doubles'
           then (select partner_id from _gmu where unit_id = slots[2 * v_k - 1]) end,
      case when v_format = 'doubles'
           then (select partner_id from _gmu where unit_id = slots[2 * v_k]) end,
      1, 'scheduled', ''
    );
  end loop;

  -- следующие раунды: пустые слоты-матчи (заполняются по ходу турнира)
  v_matches := (v_total + 1) / 2;
  v_round := 2;
  while v_matches > 1 loop
    v_matches := v_matches / 2;
    for v_k in 1..v_matches loop
      insert into public.matches (group_id, player1_id, player2_id, round, status, court)
      values (p_group_id, null, null, v_round, 'scheduled', '');
    end loop;
    v_round := v_round + 1;
  end loop;

  -- матч за 3-е место: один пустой слот в раунде финала (только при ≥4 участниках,
  -- т.е. когда в турнире есть полуфиналы). Заполняется админом вручную.
  if v_count >= 4 then
    insert into public.matches
      (group_id, player1_id, player2_id, player3_id, player4_id, round, status, court, match_kind)
    values (p_group_id, null, null, null, null, v_round - 1, 'scheduled', '', 'third_place');
  end if;
end;
$$;

comment on function public.generate_group_matches is
  'Генерация матчей группы по системе турнира: elimination (сетка на вылет + матч за 3-е место) или round_robin (каждый с каждым).';

-- ----------------------------------------------------------------------------
-- 5) Тип и функция турнирной таблицы круговой (get_group_standings)
--    Очки: победа = 2, поражение = 1 (ничьих в теннисе нет).
--    Тай-брейк мест: разница сетов, затем разница геймов, затем выигранные геймы.
-- ----------------------------------------------------------------------------
drop type if exists public.standings_entry cascade;
create type public.standings_entry as (
  unit_id     bigint,
  -- капитан стороны (в singles — игрок; в doubles — капитан пары)
  name        text,
  photo_url   text,
  club        text,
  -- партнёр для doubles (иначе null)
  partner_id  bigint,
  partner_name text,
  matches_played int,
  wins        int,
  losses      int,
  sets_won    int,
  sets_lost   int,
  games_won   int,
  games_lost  int,
  points      int,
  position    int
);

create or replace function public.get_group_standings(p_group_id bigint)
returns setof public.standings_entry
language plpgsql
security definer
set search_path = public
as $$
declare
  v_format text;
begin
  -- публичная функция: чтение таблицы доступно всем
  select t.format into v_format
  from public.groups g
  left join public.tournaments t on t.id = g.tournament_id
  where g.id = p_group_id;
  if v_format is null then v_format := 'singles'; end if;

  return query
  with finished as (
    -- завершённые матчи группы с известным победителем и счётом
    select player1_id, player2_id, winner_id, score
    from public.matches
    where group_id = p_group_id
      and status = 'finished'
      and winner_id is not null
      and score is not null
      and score !~ '^\s*$'
  ),
  sides as (
    -- одна строка на сторону матча (единица турнира = капитан player1/player2)
    select player1_id as unit_id, true  as is_side1, winner_id, score from finished
    union all
    select player2_id as unit_id, false as is_side1, winner_id, score from finished
    where player2_id is not null
  ),
  set_rows as (
    -- разворачиваем ВСЕ сеты строки счёта ("6-4 3-6 7-6(5)" → 3 строки) и
    -- парсим геймы сторон. regexp_matches с флагом 'g' возвращает {g1,g2} на сет;
    -- тай-брейк в скобках "(5)" совпадением \d+[:-]\d+ не захватывается.
    select
      s.unit_id,
      s.is_side1,
      (m.gms)[1]::int as g1,
      (m.gms)[2]::int as g2
    from sides s,
    lateral regexp_matches(trim(s.score), '(\d+)[\:\-](\d+)', 'g') as m(gms)
  ),
  match_count as (
    -- одна строка на (unit, match): матчи и победы, без разворота сетов
    select unit_id, count(*) as matches_played,
           count(*) filter (where winner_id = unit_id) as wins
    from (
      select player1_id as unit_id, winner_id from finished
      union all
      select player2_id as unit_id, winner_id from finished where player2_id is not null
    ) x
    where unit_id is not null
    group by unit_id
  ),
  set_stats as (
    -- выигрыши/проигрыши сетов и геймов по каждой единице
    select sr.unit_id,
           count(*) filter (where (sr.is_side1 and sr.g1 > sr.g2)
                              or (not sr.is_side1 and sr.g2 > sr.g1)) as sets_won,
           count(*) filter (where (sr.is_side1 and sr.g1 < sr.g2)
                              or (not sr.is_side1 and sr.g2 < sr.g1)) as sets_lost,
           sum(case when sr.is_side1 then sr.g1 else sr.g2 end) as games_won,
           sum(case when sr.is_side1 then sr.g2 else sr.g1 end) as games_lost
    from set_rows sr
    group by sr.unit_id
  ),
  ranked as (
    select
      mc.unit_id,
      mc.matches_played,
      mc.wins,
      mc.matches_played - mc.wins as losses,
      coalesce(ss.sets_won, 0)   as sets_won,
      coalesce(ss.sets_lost, 0)  as sets_lost,
      coalesce(ss.games_won, 0)  as games_won,
      coalesce(ss.games_lost, 0) as games_lost,
      mc.wins * 2 + (mc.matches_played - mc.wins) * 1 as points,
      row_number() over (
        order by
          mc.wins * 2 + (mc.matches_played - mc.wins) * 1 desc,
          (coalesce(ss.sets_won, 0) - coalesce(ss.sets_lost, 0)) desc,
          (coalesce(ss.games_won, 0) - coalesce(ss.games_lost, 0)) desc,
          coalesce(ss.games_won, 0) desc,
          mc.unit_id
      ) as position
    from match_count mc
    left join set_stats ss on ss.unit_id = mc.unit_id
  )
  select
    r.unit_id,
    p.full_name,
    p.photo_url,
    p.club,
    case when v_format = 'doubles' then gp.player_b_id else null end,
    case when v_format = 'doubles' then pb.full_name   else null end,
    r.matches_played,
    r.wins,
    r.losses,
    r.sets_won,
    r.sets_lost,
    r.games_won,
    r.games_lost,
    r.points,
    r.position
  from ranked r
  left join public.players p  on p.id = r.unit_id
  left join public.group_pairs gp on gp.group_id = p_group_id and gp.player_a_id = r.unit_id
  left join public.players pb on pb.id = gp.player_b_id
  order by r.position;
end;
$$;

comment on function public.get_group_standings is
  'Турнирная таблица группы: очки победа=2/поражение=1; тай-брейк по сетам, затем геймам. Для doubles показывает пару (капитан + партнёр).';
