-- ============================================================================
-- nina_tennis — миграция 0004: бизнес-логика в Postgres RPC
-- ----------------------------------------------------------------------------
-- Цель: убрать прослойку Next.js Server Actions. RLS уже проверяет права с
-- publishable-ключом + cookie-сессией (auth.uid()). Сложную бизнес-логику
-- (теннисный счётчик, генерация сетки, атомарные обновления) выносим в
-- security definer plpgsql-функции, которые сами перепроверяют права.
--
-- Все функции — security definer + set search_path = public (как is_admin и
-- can_user_judge_match из 0002/0001). Поскольку definer обходит RLS, права
-- проверяются явно внутри каждой функции.
--
-- ВНИМАНИЕ: комментарии в 0001 (строки ~190, 237) и 0003 (~118) про
-- «запись только через service_role» устарели — их перекрыла миграция 0002,
-- введшая auth.uid()-политики. Реально service-role ключ НЕ используется;
-- мутации идут с publishable-ключа под RLS (либо через security definer RPC).
--
-- ПРЕДПОСЫЛКА: миграции 0001, 0002, 0003 применены.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Композитный тип результата скоринга (состояние + флаги)
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.scoring_result as (state jsonb, match_over boolean, winner int);
exception when duplicate_object then null; end $$;

-- ============================================================================
-- 1. Приватные функции теннисного скоринга
-- Порт libs/shared/src/scoring.ts (addPoint / finishGame / finishSet /
-- formatScore / replayFromSides / createInitialScoringState).
-- Состояние хранится в jsonb той же формы, что и MatchScoringState в TS,
-- чтобы UI (transform.ts) читал его без изменений.
-- ============================================================================

-- Начальное состояние скоринга (createInitialScoringState).
create or replace function public._scoring_initial_state(
  p_best_of int default 3,
  p_games_per_set int default 6,
  p_tiebreak_at_deuce boolean default true
) returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'sets', '[0,0]'::jsonb,
    'games', '[[0,0]]'::jsonb,
    'points', '["0","0"]'::jsonb,
    'isTiebreak', false,
    'tiebreakPoints', '[0,0]'::jsonb,
    'currentSet', 1,
    'bestOf', p_best_of,
    'gamesPerSet', p_games_per_set,
    'tiebreakAtDeuce', p_tiebreak_at_deuce
  );
$$;

-- Обработка выигрыша сета (finishSet): +1 в sets, проверка конца матча.
create or replace function public._scoring_finish_set(p_state jsonb, p_winner int)
returns public.scoring_result
language plpgsql
immutable
set search_path = public
as $$
declare
  st jsonb := p_state;
  w int := p_winner - 1;
  needed int;
  cur_set int;
  cs int;
begin
  st := jsonb_set(st, '{isTiebreak}', 'false'::jsonb);
  st := jsonb_set(st, '{tiebreakPoints}', '[0,0]'::jsonb);
  st := jsonb_set(st, '{points}', '["0","0"]'::jsonb);

  cur_set := (st->'sets'->>w)::int + 1;
  st := jsonb_set(st, array['sets', w::text], to_jsonb(cur_set));

  -- нужно выиграть ceil(bestOf/2) сетов
  needed := ceil((st->>'bestOf')::numeric / 2.0);
  if (st->'sets'->>w)::int >= needed then
    return (st, true, p_winner)::public.scoring_result;
  end if;

  -- переход к следующему сету: гарантируем games[cs-1] существует как [0,0].
  -- Конкатенация jsonb-массивов плоская ([[x]]||[0,0] = [[x],0,0]), поэтому
  -- добавляем новый сет как самостоятельный элемент через jsonb_build_array.
  cs := (st->>'currentSet')::int + 1;
  st := jsonb_set(st, '{currentSet}', to_jsonb(cs));
  while jsonb_array_length(st->'games') < cs loop
    st := jsonb_set(st, '{games}', (st->'games') || jsonb_build_array('[0,0]'::jsonb));
  end loop;
  return (st, false, null)::public.scoring_result;
end;
$$;

-- Обработка выигрыша гейма (finishGame): +1 гейм, обнуление очков, проверка сета.
create or replace function public._scoring_finish_game(p_state jsonb, p_winner int)
returns public.scoring_result
language plpgsql
immutable
set search_path = public
as $$
declare
  st jsonb := p_state;
  w int := p_winner - 1;
  o int := 1 - w;
  cs int;
  cw int;
  co int;
  lead int;
  gps int;
  cur_games jsonb;
  set_row jsonb;
begin
  cs := (st->>'currentSet')::int;
  gps := (st->>'gamesPerSet')::int;

  -- games[currentSet-1][w] += 1: извлекаем подмассив, правим, пересобираем games.
  -- (jsonb_set по пути в массив массивов авто-расширяет/ломает структуру.)
  cur_games := st->'games';
  set_row := cur_games->(cs - 1);
  if set_row is null then set_row := '[0,0]'::jsonb; end if;
  cw := coalesce((set_row->>w)::int, 0) + 1;
  set_row := jsonb_set(set_row, array[w::text], to_jsonb(cw));
  co := coalesce((set_row->>o)::int, 0);
  st := jsonb_set(st, '{games}', jsonb_set(cur_games, array[(cs - 1)::text], set_row));

  -- обнуление очков гейма
  st := jsonb_set(st, '{points}', '["0","0"]'::jsonb);

  -- переход в тай-брейк при gamesPerSet:gamesPerSet
  if (st->>'tiebreakAtDeuce')::boolean and cw = gps and co = gps then
    st := jsonb_set(st, '{isTiebreak}', 'true'::jsonb);
    st := jsonb_set(st, '{tiebreakPoints}', '[0,0]'::jsonb);
    return (st, false, null)::public.scoring_result;
  end if;

  -- выигрыш сета: достиг gamesPerSet с отрывом 2, либо уже 7+ геймов
  lead := cw - co;
  if (cw >= gps and lead >= 2) or cw >= gps + 1 then
    return public._scoring_finish_set(st, p_winner);
  end if;
  return (st, false, null)::public.scoring_result;
end;
$$;

-- Применение очка (addPoint): основная логика счётчика.
create or replace function public._scoring_add_point(p_state jsonb, p_winner int)
returns public.scoring_result
language plpgsql
immutable
set search_path = public
as $$
declare
  st jsonb := p_state;
  w int := p_winner - 1;
  o int := 1 - w;
  wp text;      -- points[w]
  op text;      -- points[o]
  tbw int;
  lead int;
  pos int;
  seq text[] := array['0','15','30','40'];
begin
  -- --- Тай-брейк ---
  if (st->>'isTiebreak')::boolean then
    tbw := (st->'tiebreakPoints'->>w)::int + 1;
    st := jsonb_set(st, array['tiebreakPoints', w::text], to_jsonb(tbw));
    lead := tbw - (st->'tiebreakPoints'->>o)::int;
    -- тай-брейк до 7 с разницей 2
    if tbw >= 7 and lead >= 2 then
      return public._scoring_finish_set(st, p_winner);
    end if;
    return (st, false, null)::public.scoring_result;
  end if;

  -- --- Обычный гейм ---
  wp := st->'points'->>w;
  op := st->'points'->>o;

  -- соперник на advantage — отбираем преимущество (40:40)
  if op = 'AD' then
    st := jsonb_set(st, array['points', o::text], '"40"'::jsonb);
    return (st, false, null)::public.scoring_result;
  end if;
  -- победитель на advantage — гейм выигран
  if wp = 'AD' then
    return public._scoring_finish_game(st, p_winner);
  end if;
  -- победитель на 40
  if wp = '40' then
    if op = '40' then
      st := jsonb_set(st, array['points', w::text], '"AD"'::jsonb);
      return (st, false, null)::public.scoring_result;
    end if;
    return public._scoring_finish_game(st, p_winner);
  end if;

  -- обычное продвижение по последовательности 0→15→30→40
  pos := array_position(seq, wp);
  if pos is null then
    st := jsonb_set(st, array['points', w::text], '"0"'::jsonb);
    return (st, false, null)::public.scoring_result;
  end if;
  if pos + 1 > array_length(seq, 1) then
    return public._scoring_finish_game(st, p_winner);
  end if;
  st := jsonb_set(st, array['points', w::text], to_jsonb(seq[pos + 1]));
  return (st, false, null)::public.scoring_result;
end;
$$;

-- Переигрывание истории из начального состояния (replayFromSides).
create or replace function public._scoring_replay(p_init jsonb, p_sides int[])
returns public.scoring_result
language plpgsql
immutable
set search_path = public
as $$
declare
  st jsonb := p_init;
  res public.scoring_result;
  i int;
begin
  i := coalesce(array_lower(p_sides, 1), 0);
  while i is not null and i <= coalesce(array_length(p_sides, 1), -1) loop
    res := public._scoring_add_point(st, p_sides[i]);
    st := res.state;
    i := i + 1;
  end loop;
  return (st, false, null)::public.scoring_result;
end;
$$;

-- Сериализация состояния в строку счёта (formatScore): "6-4 3-6 7-6(5)".
create or replace function public._scoring_format_score(p_state jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  n int := coalesce(jsonb_array_length(p_state->'games'), 0);
  parts text[] := array[]::text[];
  cs int;
  is_tb boolean;
  tb0 int;
  tb1 int;
  g0 int;
  g1 int;
  set_str text;
begin
  if n = 0 then return ''; end if;
  cs := (p_state->>'currentSet')::int;
  is_tb := (p_state->>'isTiebreak')::boolean;
  tb0 := coalesce((p_state->'tiebreakPoints'->>0)::int, 0);
  tb1 := coalesce((p_state->'tiebreakPoints'->>1)::int, 0);

  for i in 0..n - 1 loop
    g0 := (p_state->'games'->i->>0)::int;
    g1 := (p_state->'games'->i->>1)::int;
    -- не показываем текущий пустой сет (0:0) вне тай-брейка
    if g0 = 0 and g1 = 0 and i = n - 1 and not is_tb then
      continue;
    end if;
    set_str := g0::text || '-' || g1::text;
    -- тай-брейк текущего сета: дописываем счёт проигравшего, напр. 7-6(5)
    if is_tb and i = cs - 1 and (tb0 > 0 or tb1 > 0) then
      if tb0 > tb1 then
        set_str := set_str || '(' || tb1::text || ')';
      else
        set_str := set_str || '(' || tb0::text || ')';
      end if;
    end if;
    parts := parts || set_str;
  end loop;

  return array_to_string(parts, ' ');
end;
$$;

-- ============================================================================
-- 2. score_match_point — судейство матча (add / undo / reset).
-- Замена updateMatchScore + resetMatchScore. Атомарно: SELECT FOR UPDATE +
-- пересчёт + UPDATE + upsert match_judges в одной транзакции. Решает race
-- condition двух одновременных судейских нажатий.
-- ============================================================================
create or replace function public.score_match_point(
  p_match_id bigint,
  p_action text,
  p_winner int default null
) returns setof public.v_matches_full
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_state jsonb;
  v_hist int[];
  v_p1 bigint;
  v_p2 bigint;
  bo int;
  gps int;
  tad boolean;
  res public.scoring_result;
  init_st jsonb;
  patch_status text;
  patch_winner bigint;
  patch_played timestamptz;
begin
  -- --- права: admin или судья этого матча ---
  if uid is null then
    raise exception 'Требуется авторизация' using errcode = '42501';
  end if;
  if not public.is_admin() and not public.can_user_judge_match(p_match_id, uid) then
    raise exception 'Нет прав судить этот матч' using errcode = '42501';
  end if;

  -- --- блокируем строку матча на время транзакции ---
  select scoring_state, point_history, player1_id, player2_id
    into v_state, v_hist, v_p1, v_p2
  from public.matches
  where id = p_match_id
  for update;
  if not found then
    raise exception 'Матч не найден' using errcode = 'P0002';
  end if;

  v_hist := coalesce(v_hist, array[]::int[]);

  -- конфиг скоринга из состояния или дефолты
  if v_state is null then
    bo := 3; gps := 6; tad := true;
    v_state := public._scoring_initial_state(bo, gps, tad);
  else
    bo := (v_state->>'bestOf')::int;
    gps := (v_state->>'gamesPerSet')::int;
    tad := (v_state->>'tiebreakAtDeuce')::boolean;
  end if;

  if p_action = 'reset' then
    v_state := public._scoring_initial_state(bo, gps, tad);
    v_hist := array[]::int[];
    update public.matches set
      scoring_state = v_state,
      point_history = v_hist,
      score = public._scoring_format_score(v_state),
      status = 'scheduled',
      winner_id = null,
      played_at = null
    where id = p_match_id;

  elsif p_action = 'add' then
    if p_winner not in (1, 2) then
      raise exception 'Нужен winner (1 или 2)' using errcode = '22023';
    end if;
    res := public._scoring_add_point(v_state, p_winner);
    v_state := res.state;
    v_hist := v_hist || p_winner;
    if res.match_over and res.winner is not null then
      patch_status := 'finished';
      patch_played := now();
      patch_winner := case when res.winner = 1 then v_p1 else v_p2 end;
    else
      patch_status := 'in_progress';
    end if;
    update public.matches set
      scoring_state = v_state,
      point_history = v_hist,
      score = public._scoring_format_score(v_state),
      status = patch_status,
      winner_id = coalesce(patch_winner, winner_id),
      played_at = coalesce(patch_played, played_at)
    where id = p_match_id;

  elsif p_action = 'undo' then
    if array_length(v_hist, 1) is not null and array_length(v_hist, 1) > 0 then
      v_hist := v_hist[1 : array_length(v_hist, 1) - 1];
      init_st := public._scoring_initial_state(bo, gps, tad);
      res := public._scoring_replay(init_st, v_hist);
      v_state := res.state;
      update public.matches set
        scoring_state = v_state,
        point_history = v_hist,
        score = public._scoring_format_score(v_state),
        status = 'in_progress',
        winner_id = null
      where id = p_match_id;
    end if;
    -- undo пустой истории — ничего не делаем

  else
    raise exception 'Неизвестное действие: %', p_action using errcode = '22023';
  end if;

  -- --- фиксация судьи в истории (идемпотентно) ---
  insert into public.match_judges (match_id, user_id)
  values (p_match_id, uid)
  on conflict (match_id, user_id) do nothing;

  return query select * from public.v_matches_full where id = p_match_id;
end;
$$;

comment on function public.score_match_point is
  'Судейство матча: add (очко)/undo (отмена)/reset. Атомарно. Права: admin или судья матча.';

-- ============================================================================
-- 3. generate_group_matches — генерация олимпийской сетки (snake-seeding).
-- Замена generateMatches + generateKnockoutBracket. Атомарно: чтение единиц,
-- посев/перемешивание, удаление старых и вставка новых матчей.
-- ============================================================================
create or replace function public.generate_group_matches(p_group_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_format text;
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
begin
  if uid is null or not public.is_admin() then
    raise exception 'Требуются права администратора' using errcode = '42501';
  end if;

  -- формат турнира группы (по умолчанию singles)
  select t.format into v_format
  from public.groups g
  left join public.tournaments t on t.id = g.tournament_id
  where g.id = p_group_id;
  if v_format is null then v_format := 'singles'; end if;

  -- временная таблица единиц турнира
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
end;
$$;

comment on function public.generate_group_matches is
  'Генерация сетки single elimination (snake-seeding) для группы. Атомарно. Только админ.';

-- ============================================================================
-- 4. update_group_full — атомарное обновление группы + игроков/посева/пар.
-- Замена updateGroup + syncGroupPlayers/Seeds/Pairs/PairSeeds (4+ неатомарных
-- вызова). Параметры-массивы со значением NULL означают «не менять».
-- Контракт: name и tournament_id клиент передаёт всегда (актуальные значения).
-- ============================================================================
create or replace function public.update_group_full(
  p_id bigint,
  p_name text default null,
  p_tournament_id bigint default null,
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

  -- обновление полей группы
  if p_name is not null then
    update public.groups set
      name = p_name,
      tournament_id = p_tournament_id
    where id = p_id;
  else
    update public.groups set tournament_id = p_tournament_id where id = p_id;
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

comment on function public.update_group_full is
  'Атомарное обновление группы и её состава/посева/пар. Только админ.';

-- ============================================================================
-- 5. accept_referee_invite — приём приглашения судьёй.
-- Замена acceptRefereeInvite. Передаётся только токен (tournament_id
-- резолвится внутри — не доверяем клиенту). Идемпотентный upsert + повышение
-- роли user → referee.
-- ============================================================================
create or replace function public.accept_referee_invite(p_token text)
returns table(tournament_id bigint, tournament_name text, success boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id bigint;
  v_name text;
  v_role text;
begin
  if uid is null then
    raise exception 'Требуется авторизация' using errcode = '42501';
  end if;

  select id, name into v_id, v_name
  from public.tournaments
  where referee_invite_token = p_token;
  if not found then
    raise exception 'Приглашение недействительно' using errcode = 'P0002';
  end if;

  insert into public.tournament_referees (tournament_id, user_id)
    values (v_id, uid)
    on conflict do nothing;

  -- повышение роли user → referee (admin/referee не трогаем)
  select role into v_role from public.profiles where id = uid;
  if v_role = 'user' then
    update public.profiles set role = 'referee' where id = uid;
  end if;

  return query select v_id, v_name, true;
end;
$$;

comment on function public.accept_referee_invite is
  'Принять приглашение судьёй по токену. Идемпотентно.';

-- ============================================================================
-- 6. update_match_admin — обновление матча судьёй/админом (произвольный патч).
-- Замена updateMatch. Патч передаётся jsonb; ключи воспроизводят «field-present»
-- семантику TS (присутствие ключа = изменить). Права: admin или судья матча.
-- ============================================================================
create or replace function public.update_match_admin(
  p_match_id bigint,
  p_patch jsonb
) returns setof public.v_matches_full
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_role text;
  v_cur_ref uuid;
  v_ref uuid;
begin
  if uid is null then
    raise exception 'Требуется авторизация' using errcode = '42501';
  end if;
  if not public.is_admin() and not public.can_user_judge_match(p_match_id, uid) then
    raise exception 'Нет прав судить этот матч' using errcode = '42501';
  end if;

  -- определение referee_id (пин судьи)
  select referee_id into v_cur_ref from public.matches where id = p_match_id;
  select role into v_role from public.profiles where id = uid;
  if p_patch ? 'refereeId' then
    v_ref := nullif(p_patch->>'refereeId', '')::uuid;
  elsif v_role = 'referee' then
    v_ref := uid;
  else
    v_ref := v_cur_ref;
  end if;

  update public.matches set
    score         = case when p_patch ? 'score'         then p_patch->>'score'            else score end,
    status        = case when p_patch ? 'status'        then p_patch->>'status'           else status end,
    winner_id     = case when p_patch ? 'winnerId'      then nullif(p_patch->>'winnerId','')::bigint     else winner_id end,
    scoring_state = case when p_patch ? 'scoringState'  then p_patch->'scoringState'      else scoring_state end,
    point_history = case when p_patch ? 'pointHistory'
                        then coalesce((select array_agg(x::int) from jsonb_array_elements_text(p_patch->'pointHistory') as x), array[]::int[])
                        else point_history end,
    scheduled_at  = case when p_patch ? 'scheduledAt'   then nullif(p_patch->>'scheduledAt','')::timestamptz else scheduled_at end,
    played_at     = case when p_patch ? 'playedAt'      then nullif(p_patch->>'playedAt','')::timestamptz    else played_at end,
    court         = case when p_patch ? 'court'         then p_patch->>'court'            else court end,
    round         = case when p_patch ? 'round'         then nullif(p_patch->>'round','')::int else round end,
    server_side   = case when p_patch ? 'serverSide'    then nullif(p_patch->>'serverSide','') else server_side end,
    court_side_p1 = case when p_patch ? 'courtSide'     then nullif(p_patch->'courtSide'->>'p1','') else court_side_p1 end,
    court_side_p2 = case when p_patch ? 'courtSide'     then nullif(p_patch->'courtSide'->>'p2','') else court_side_p2 end,
    player1_id    = case when p_patch ? 'player1Id'     then nullif(p_patch->>'player1Id','')::bigint else player1_id end,
    player2_id    = case when p_patch ? 'player2Id'     then nullif(p_patch->>'player2Id','')::bigint else player2_id end,
    player3_id    = case when p_patch ? 'player3Id'     then nullif(p_patch->>'player3Id','')::bigint else player3_id end,
    player4_id    = case when p_patch ? 'player4Id'     then nullif(p_patch->'player4Id','')::bigint else player4_id end,
    referee_id    = v_ref
  where id = p_match_id;

  -- история судейства: добавляем текущего пользователя (идемпотентно)
  insert into public.match_judges (match_id, user_id)
    values (p_match_id, uid)
    on conflict (match_id, user_id) do nothing;

  return query select * from public.v_matches_full where id = p_match_id;
end;
$$;

comment on function public.update_match_admin is
  'Обновление матча произвольным патчем (jsonb). Права: admin или судья матча.';

-- ============================================================================
-- 7. generate_referee_invite — генерация токена приглашения судей.
-- Замена generateRefereeInvite (crypto.randomBytes(24) → gen_random_bytes(24)).
-- ============================================================================
create or replace function public.generate_referee_invite(p_tournament_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.is_admin() then
    raise exception 'Требуются права администратора' using errcode = '42501';
  end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  update public.tournaments set referee_invite_token = v_token where id = p_tournament_id;
  return v_token;
end;
$$;

comment on function public.generate_referee_invite is
  'Сгенерировать многоразовый токен приглашения судей для турнира. Только админ.';
