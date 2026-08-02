-- ============================================================================
-- nina_tennis — миграция 0008: устранение 22P02 в update_match_admin
-- ============================================================================
-- Симптом: при сохранении матча админ получал
--   22P02: invalid input syntax for type json
--   "The input string ended unexpectedly"
-- хотя отправляемый p_patch — валидный JSON ({"score":"","status":...}).
--
-- Причина: живая функция в БД рассинхронизирована с репозиторием. Версия из
-- миграции 0004 безопасна (нет text→json приведений для полей без scoringState),
-- но в живой БД осталась более старая/битая версия с таким приведением, которое
-- срабатывает ПОСЛЕ прохождения проверки прав. CREATE OR REPLACE НЕ заменяет
-- тело, если в живой БД уже есть перегрузка с тем же именем, но иным списком
-- аргументов — он создаёт ещё одну, и PostgREST может выбрать не ту.
--
-- Решение (как в 0007 для update_group_full): жёстко удалить ВСЕ перегрузки
-- update_match_admin и создать единственную — корректную версию.
-- ============================================================================

-- Подстраховка: удаляем ЛЮБУЮ перегрузку через цикл по pg_proc.
do $$
declare
  sig text;
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

-- ЕДИНСТВЕННАЯ версия функции: безопасный патч по jsonb, без text→json приведений.
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
    -- scoring_state берётся как jsonb напрямую (-> ), без text→json — это и было источником 22P02.
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
    referee_id    = v_ref
  where id = p_match_id;

  -- история судейства: добавляем текущего пользователя (идемпотентно)
  insert into public.match_judges (match_id, user_id)
    values (p_match_id, uid)
    on conflict (match_id, user_id) do nothing;

  return query select * from public.v_matches_full where id = p_match_id;
end;
$$;

comment on function public.update_match_admin(bigint, jsonb) is
  'Обновление матча произвольным патчем (jsonb). Права: admin или судья матча.';
