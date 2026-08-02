-- ============================================================================
-- nina_tennis — миграция 0006: система проведения переносится на ГРУППУ
-- ============================================================================
-- Контекст: в 0005 система (elimination/round_robin) жила на турнире. По новому
-- требованию источник истины — ГРУППА: в одном турнире могут быть группы с разными
-- системами проведения. Поле tournaments.system остаётся как ЗНАЧЕНИЕ ПО УМОЛЧАНИЮ:
-- новая группа наследует его от турнира (через триггер), но затем редактируется
-- независимо на уровне группы.
--
-- Изменения:
--  1) groups.system — фактическая система проведения группы.
--  2) Триггер BEFORE INSERT: groups.system = coalesce(tournaments.system,'elimination').
--  3) generate_group_matches читает coalesce(g.system, t.system, 'elimination').
--  4) update_group_full — новый параметр p_system для смены системы группы.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Колонка system на группе
-- ----------------------------------------------------------------------------
alter table public.groups
  add column if not exists system text
  check (system is null or system in ('elimination','round_robin'));

comment on column public.groups.system is
  'Система проведения группы: elimination или round_robin. NULL до заполнения триггером (наследует турнир).';

-- Переносим уже хранимые на турнире значения в существующие группы (обратная совместимость).
update public.groups g
  set system = coalesce((select t.system from public.tournaments t where t.id = g.tournament_id), 'elimination')
  where g.system is null;

-- ----------------------------------------------------------------------------
-- 2) Триггер наследования: новая группа берёт system/format из турнира.
--    format живёт на турнире (не дублируем), а system — копируем в группу,
--    чтобы далее редактировать независимо.
-- ----------------------------------------------------------------------------
create or replace function public.set_group_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system text;
begin
  if new.tournament_id is not null then
    select t.system into v_system
    from public.tournaments t
    where t.id = new.tournament_id;
  end if;
  if new.system is null then
    new.system := coalesce(v_system, 'elimination');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_group_defaults on public.groups;
create trigger trg_set_group_defaults
  before insert on public.groups
  for each row execute function public.set_group_defaults();

comment on function public.set_group_defaults is
  'Наследование системой проведения группы от турнира при создании группы.';

-- ----------------------------------------------------------------------------
-- 3) generate_group_matches — система читается с группы (с откатом на турнир).
--    Полностью пересоздаём функцию из 0005, заменяя только источник system.
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

  -- формат с турнира; система — с группы (откат на турнир по умолчанию).
  select t.format, coalesce(g.system, t.system, 'elimination') into v_format, v_system
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
  'Генерация матчей группы по системе ГРУППЫ (coalesce(groups.system, tournaments.system)): elimination (сетка на вылет + матч за 3-е место) или round_robin (каждый с каждым).';

-- ----------------------------------------------------------------------------
-- 4) update_group_full — новый параметр p_system для смены системы группы.
--    NULL означает «не менять» (как и у других параметров-массивов).
--    Сначала явно удаляем старую 7-параметровую сигнатуру (из миграции 0004):
--    CREATE OR REPLACE не меняет список аргументов существующей функции, а лишь
--    добавил бы вторую перегрузку, делая комментарий неоднозначным (42725).
-- ----------------------------------------------------------------------------
drop function if exists public.update_group_full(bigint, text, bigint, bigint[], jsonb, jsonb, jsonb);
create or replace function public.update_group_full(
  p_id bigint,
  p_name text default null,
  p_tournament_id bigint default null,
  p_system text default null,
  p_players bigint[] default null,         -- желаемый состав игроков
  p_seeds jsonb default null,              -- [{player_id, seed}]
  p_pairs jsonb default null,              -- [{a_id, b_id}]
  p_pair_seeds jsonb default null          -- [{player_a_id, seed}]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Требуются права администратора' using errcode = '42501';
  end if;

  -- обновление полей группы (включая систему проведения)
  if p_name is not null then
    update public.groups set
      name = p_name,
      tournament_id = p_tournament_id,
      system = case when p_system is not null then p_system else system end
    where id = p_id;
  else
    update public.groups set
      tournament_id = p_tournament_id,
      system = case when p_system is not null then p_system else system end
    where id = p_id;
  end if;

  -- состав игроков: дифф (удалить лишних + добавить новых)
  if p_players is not null then
    delete from public.group_players
      where group_id = p_id and not (player_id = any(p_players));
    insert into public.group_players (group_id, player_id)
      select p_id, x from unnest(p_players) as x
      on conflict do nothing;
  end if;

  -- посев (singles): полная замена
  if p_seeds is not null then
    delete from public.group_seeds where group_id = p_id;
    insert into public.group_seeds (group_id, player_id, seed)
      select p_id, (j->>'player_id')::bigint, (j->>'seed')::int
      from jsonb_array_elements(p_seeds) as j;
  end if;

  -- пары (doubles): полная замена
  if p_pairs is not null then
    delete from public.group_pairs where group_id = p_id;
    insert into public.group_pairs (group_id, player_a_id, player_b_id)
      select p_id, (j->>'a_id')::bigint, (j->>'b_id')::bigint
      from jsonb_array_elements(p_pairs) as j
      where (j->>'a_id') is not null
        and (j->>'b_id') is not null
        and (j->>'a_id')::bigint <> (j->>'b_id')::bigint;
  end if;

  -- посев пар (doubles): полная замена
  if p_pair_seeds is not null then
    delete from public.group_pair_seeds where group_id = p_id;
    insert into public.group_pair_seeds (group_id, player_a_id, seed)
      select p_id, (j->>'player_a_id')::bigint, (j->>'seed')::int
      from jsonb_array_elements(p_pair_seeds) as j;
  end if;
end;
$$;

comment on function public.update_group_full(
  bigint, text, bigint, text, bigint[], jsonb, jsonb, jsonb
) is
  'Атомарное обновление группы (имя, турнир, система проведения) и её состава/посева/пар. Только админ.';
