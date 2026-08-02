-- ============================================================================
-- nina_tennis — миграция 0007: устранение неоднозначности update_group_full
-- ============================================================================
-- Причина: миграция 0006 добавила параметр p_system в update_group_full через
-- CREATE OR REPLACE. Но CREATE OR REPLACE НЕ меняет список аргументов уже
-- существующей функции — оно создало ВТОРУЮ перегрузку (7-параметровую из 0004
-- и 8-параметровую из 0006). В итоге comment on function стал неоднозначным
-- (ошибка 42725: function name "public.update_group_full" is not unique).
--
-- Решение: жёстко удаляем ВСЕ перегрузки update_group_full (какой бы набор
-- аргументов ни существовал) и создаём единственную — с p_system.
-- ============================================================================

-- Удаляем известные сигнатуры (if exists — молчит, если такой нет).
drop function if exists public.update_group_full(bigint, text, bigint, bigint[], jsonb, jsonb, jsonb);   -- старая из 0004
drop function if exists public.update_group_full(bigint, text, bigint, text, bigint[], jsonb, jsonb, jsonb); -- из 0006

-- Подстраховка: удаляем ЛЮБУЮ оставшуюся перегрузку через цикл по pg_proc,
-- чтобы гарантированно осталась одна функция после пересоздания ниже.
do $$
declare
  sig text;
begin
  for sig in
    select pg_get_function_identity_arguments(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'update_group_full'
  loop
    execute format('drop function if exists public.update_group_full(%s)', sig);
  end loop;
end;
$$;

-- ЕДИНСТВЕННАЯ версия функции: с параметром p_system.
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
