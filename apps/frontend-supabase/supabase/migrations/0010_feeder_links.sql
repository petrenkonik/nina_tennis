-- ============================================================================
-- nina_tennis — миграция 0010: связки слотов с «Победителем матча #N» (feeder)
-- ============================================================================
-- Позволяет привязать сторону матча (player1 или player2) к победителю другого
-- матча — даже до того, как источник сыгран. Слот показывает «Победитель матча
-- #N (TBD)», а когда источник завершён, advance_winners копирует winner_id.
--
-- Семантика двух новых колонок p1_feeds_from / p2_feeds_from:
--   - feeder != null + player_id == null  → сторона = «Победитель матча #N (TBD)»
--   - feeder != null + player_id != null  → сторона резолвнута (feeder сохранён)
--   - feeder == null                      → явный выбор игрока/пары (как раньше)
-- ============================================================================

-- 1) Колонки-связки (self-FK: при удалении источника feeder обнуляется).
--    NULL = «явный выбор игрока/пары» либо «вычислить позиционно» (см. advance_winners).
--    != NULL = явная ручная привязка к победителю конкретного матча.
alter table public.matches
  add column if not exists p1_feeds_from bigint,
  add column if not exists p2_feeds_from bigint;

alter table public.matches
  drop constraint if exists matches_p1_feeds_from_fkey;
alter table public.matches
  add constraint matches_p1_feeds_from_fkey
  foreign key (p1_feeds_from) references public.matches(id) on delete set null;

alter table public.matches
  drop constraint if exists matches_p2_feeds_from_fkey;
alter table public.matches
  add constraint matches_p2_feeds_from_fkey
  foreign key (p2_feeds_from) references public.matches(id) on delete set null;

-- 2) View v_matches_full: добавляем feeder-поля + метаданные источника стороны 1/2
--    (round источника и имена его игроков), чтобы UI показал «#15 · А vs Б».
--    Новые колонки — в END SELECT (нельзя менять порядок/имена существующих).
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
  m.match_kind,
  -- feeder источника стороны 1: id, раунд, имена обоих игроков сторон
  m.p1_feeds_from,
  fs1.round       as p1_feeder_round,
  fs1a.full_name  as p1_feeder_a_name,
  fs1b.full_name  as p1_feeder_b_name,
  -- feeder источника стороны 2
  m.p2_feeds_from,
  fs2.round       as p2_feeder_round,
  fs2a.full_name  as p2_feeder_a_name,
  fs2b.full_name  as p2_feeder_b_name
from public.matches m
left join public.groups   g  on g.id = m.group_id
left join public.players  p1 on p1.id = m.player1_id
left join public.players  p2 on p2.id = m.player2_id
left join public.players  p3 on p3.id = m.player3_id
left join public.players  p4 on p4.id = m.player4_id
left join public.profiles ref on ref.id = m.referee_id
-- self-join к матчам-источникам для метаданных feeder'а.
left join public.matches fs1 on fs1.id = m.p1_feeds_from
left join public.players fs1a on fs1a.id = fs1.player1_id
left join public.players fs1b on fs1b.id = fs1.player2_id
left join public.matches fs2 on fs2.id = m.p2_feeds_from
left join public.players fs2a on fs2a.id = fs2.player1_id
left join public.players fs2b on fs2b.id = fs2.player2_id;

comment on view public.v_matches_full is
  'Матч со связями (игроки, партнёры пар, судья, группа) + feeder-источники сторон (Победитель матча #N). Замена Mongo populate.';

-- ============================================================================
-- 3) Пересоздаём advance_winners: учитываем ЯВНЫЕ feeder-связки.
--    Если у стороны цели задан p1_feeds_from/p2_feeds_from — победитель берётся
--    из этого конкретного матча (ручная привязка). Иначе — позиционно, как было.
--    Жёстко удаляем все перегрузки и создаём единственную версию.
-- ============================================================================
do $$
declare sig text;
begin
  for sig in
    select pg_get_function_identity_arguments(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'advance_winners'
  loop
    execute format('drop function if exists public.advance_winners(%s)', sig);
  end loop;
end;
$$;

create or replace function public.advance_winners(p_group_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_format text;
begin
  if uid is null or not public.is_admin() then
    raise exception 'Требуются права администратора' using errcode = '42501';
  end if;

  select t.format into v_format
  from public.groups g
  left join public.tournaments t on t.id = g.tournament_id
  where g.id = p_group_id;
  if v_format is null then v_format := 'singles'; end if;

  -- _adv: все обычные матчи с позицией внутри раунда и «эффективным победителем».
  drop table if exists pg_temp._adv;
  create temp table _adv as
  select
    id, round,
    row_number() over (partition by round order by id) - 1 as pos,
    p1_feeds_from, p2_feeds_from,
    player1_id, player2_id, player3_id, player4_id,
    coalesce(
      winner_id,
      case
        when status in ('scheduled','in_progress') and player1_id is not null and player2_id is null
          then player1_id
        when status in ('scheduled','in_progress') and player1_id is null and player2_id is not null
          then player2_id
        else null
      end
    ) as eff_winner
  from public.matches
  where group_id = p_group_id and match_kind = 'normal';

  create index on _adv (round, pos);
  create index on _adv (id);

  -- _src: карта (target_id, source_id для стороны 1, source_id для стороны 2).
  --   источник стороны = ЯВНЫЙ feeder, если задан; иначе позиционный матч
  --   (round-1, pos = target_pos*2 для стороны 1, pos*2+1 для стороны 2).
  drop table if exists pg_temp._src;
  create temp table _src as
  select
    t.id as tgt_id,
    coalesce(t.p1_feeds_from, ps1.src_id) as s1_id,
    coalesce(t.p2_feeds_from, ps2.src_id) as s2_id
  from _adv t
  left join lateral (
    select x.id as src_id from _adv x where x.round = t.round - 1 and x.pos = t.pos * 2
  ) ps1 on true
  left join lateral (
    select x.id as src_id from _adv x where x.round = t.round - 1 and x.pos = t.pos * 2 + 1
  ) ps2 on true;

  -- Один UPDATE: победитель источника → сторона цели. Партнёр (doubles) со
  -- стороны победителя. Уже сыгранные цели (status='finished') не трогаем.
  update public.matches as tgt
  set
    player1_id = fs1.eff_winner,
    player2_id = fs2.eff_winner,
    player3_id = case when v_format = 'doubles'
                      then case when fs1.eff_winner = fs1.player1_id then fs1.player3_id
                                when fs1.eff_winner = fs1.player2_id then fs1.player4_id
                                else null end
                      else null end,
    player4_id = case when v_format = 'doubles'
                      then case when fs2.eff_winner = fs2.player1_id then fs2.player3_id
                                when fs2.eff_winner = fs2.player2_id then fs2.player4_id
                                else null end
                      else null end
  from _src, _adv fs1, _adv fs2
  where _src.tgt_id = tgt.id
    and tgt.group_id = p_group_id
    and tgt.match_kind = 'normal'
    and tgt.status <> 'finished'
    and fs1.id = _src.s1_id
    and fs2.id = _src.s2_id;

  drop table if exists pg_temp._src;
  drop table if exists pg_temp._adv;
end;
$$;

comment on function public.advance_winners(bigint) is
  'Перенос победителей (и BYE-сторон) в слоты следующего раунда. Учитывает явные feeder-связки (p1_feeds_from/p2_feeds_from) — иначе позиционно. Только админ.';

-- ============================================================================
-- 4) Пересоздаём update_match_admin: добавляем поддержку feeder-полей в патче.
--    p1FeedsFrom / p2FeedsFrom (id матча-источника или null).
-- ============================================================================
do $$
declare sig text;
begin
  for sig in
    select pg_get_function_identity_arguments(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'update_match_admin'
  loop
    execute format('drop function if exists public.update_match_admin(%s)', sig);
  end loop;
end;
$$;

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
    player4_id    = case when p_patch ? 'player4Id'     then nullif(p_patch->>'player4Id','')::bigint else player4_id end,
    -- feeder-связки (Победитель матча #N): id источника или null (явный сброс).
    p1_feeds_from = case when p_patch ? 'p1FeedsFrom'   then nullif(p_patch->>'p1FeedsFrom','')::bigint else p1_feeds_from end,
    p2_feeds_from = case when p_patch ? 'p2FeedsFrom'   then nullif(p_patch->>'p2FeedsFrom','')::bigint else p2_feeds_from end,
    referee_id    = v_ref
  where id = p_match_id;

  insert into public.match_judges (match_id, user_id)
    values (p_match_id, uid)
    on conflict (match_id, user_id) do nothing;

  return query select * from public.v_matches_full where id = p_match_id;
end;
$$;

comment on function public.update_match_admin(bigint, jsonb) is
  'Обновление матча произвольным патчем (jsonb), включая feeder-связки. Права: admin или судья матча.';
