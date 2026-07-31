-- ============================================================================
-- Тест эквивалентности порта scoring.ts → plpgsql.
-- Воспроизводит сценарии из libs/shared/src/scoring.spec.ts и проверяет, что
-- приватные plpgsql-функции дают те же результаты, что TS-эталон.
-- Запуск: psql -f supabase/tests/test_scoring_rpc.sql
-- (предполагается, что миграция 0004 применена)
-- ============================================================================
\set ON_ERROR_STOP on
set client_min_messages to warning;

-- Вспомогательная «счётная» таблица результатов тестов
drop table if exists pg_temp._t;
create temp table _t (name text, ok boolean, detail text);

do $$
declare
  st jsonb;
  r public.scoring_result;
  init jsonb;
begin
  -- ---- Тест 1: 4 очка = гейм, очки сброшены ----
  st := public._scoring_initial_state(3);
  r := public._scoring_add_point(st, 1); st := r.state;  -- 15
  insert into _t values ('point1=15', (st->'points'->>0) = '15', st->'points'->>0);
  r := public._scoring_add_point(st, 1); st := r.state;  -- 30
  insert into _t values ('point1=30', (st->'points'->>0) = '30', st->'points'->>0);
  r := public._scoring_add_point(st, 1); st := r.state;  -- 40
  insert into _t values ('point1=40', (st->'points'->>0) = '40', st->'points'->>0);
  r := public._scoring_add_point(st, 1); st := r.state;  -- гейм
  insert into _t values ('после гейма очки сброшены', (st->'points'->>0) = '0', st->'points'->>0);
  insert into _t values ('games[0][0]=1', (st->'games'->0->>0) = '1', st->'games'->0->>0);

  -- ---- Тест 2: deuce/advantage (40:40 → AD → отбор → AD → гейм) ----
  init := public._scoring_initial_state(3);
  -- 3 очка p1, 3 очка p2 = 40:40
  st := init;
  r := public._scoring_add_point(st,1); st:=r.state;
  r := public._scoring_add_point(st,1); st:=r.state;
  r := public._scoring_add_point(st,1); st:=r.state;
  r := public._scoring_add_point(st,2); st:=r.state;
  r := public._scoring_add_point(st,2); st:=r.state;
  r := public._scoring_add_point(st,2); st:=r.state;
  insert into _t values ('40:40 deuce', (st->'points'->>0)='40' and (st->'points'->>1)='40', st->'points'::text);
  r := public._scoring_add_point(st,1); st:=r.state;  -- AD p1
  insert into _t values ('player1 advantage', (st->'points'->>0)='AD', st->'points'->>0);
  r := public._scoring_add_point(st,2); st:=r.state;  -- обратно 40:40
  insert into _t values ('back to deuce', (st->'points'->>0)='40' and (st->'points'->>1)='40', st->'points'::text);
  r := public._scoring_add_point(st,2); st:=r.state;  -- AD p2
  insert into _t values ('player2 advantage', (st->'points'->>1)='AD', st->'points'->>1);
  r := public._scoring_add_point(st,2); st:=r.state;  -- гейм p2
  insert into _t values ('player2 won game', (st->'games'->0->>1)='1', st->'games'->0->>1);

  -- ---- Тест 3: выигрыш сета 6-0 (24 очка p1) ----
  init := public._scoring_initial_state(3);
  st := init;
  for i in 1..24 loop
    r := public._scoring_add_point(st, 1); st := r.state;
  end loop;
  insert into _t values ('set1 won 6-0', (st->'sets'->>0)='1' and (st->'sets'->>1)='0', st->'sets'::text);
  insert into _t values ('score 6-0', public._scoring_format_score(st)='6-0', public._scoring_format_score(st));

  -- ---- Тест 4: тай-брейк при 6:6, выигрыш 7-2 ----
  -- 5 геймов p1 (20 очков), 5 геймов p2 (20), 1 гейм p1 (4) = 6-5, 1 гейм p2 (4) = 6:6 → tiebreak
  init := public._scoring_initial_state(3);
  st := init;
  for i in 1..20 loop r:=public._scoring_add_point(st,1); st:=r.state; end loop;  -- 5-0
  for i in 1..20 loop r:=public._scoring_add_point(st,2); st:=r.state; end loop;  -- 5:5
  for i in 1..4  loop r:=public._scoring_add_point(st,1); st:=r.state; end loop;  -- 6:5
  for i in 1..4  loop r:=public._scoring_add_point(st,2); st:=r.state; end loop;  -- 6:6
  insert into _t values ('вошли в тай-брейк при 6:6', (st->>'isTiebreak')='true', st->>'isTiebreak');
  insert into _t values ('6:6 в геймах', (st->'games'->0->>0)='6' and (st->'games'->0->>1)='6', st->'games'->0::text);
  -- p1 выигрывает тай-брейк 7:0 (7 очков подряд → lead 7 ≥ 2 при ≥7)
  for i in 1..7 loop r:=public._scoring_add_point(st,1); st:=r.state; end loop;
  insert into _t values ('set1 won via tiebreak', (st->'sets'->>0)='1', st->'sets'::text);
  insert into _t values ('best-of-3 → не окончен после 1 сета', r.match_over=false, r.match_over::text);

  -- ---- Тест 5: выигрыш матча 2 сетами по 6-0 ----
  init := public._scoring_initial_state(3);
  st := init;
  -- сет 1: 24 очка p1
  for i in 1..24 loop r:=public._scoring_add_point(st,1); st:=r.state; end loop;
  -- сет 2: 24 очка p1
  for i in 1..24 loop r:=public._scoring_add_point(st,1); st:=r.state; end loop;
  insert into _t values ('match over after 2 sets', r.match_over=true, r.match_over::text);
  insert into _t values ('winner is player 1', r.winner=1, coalesce(r.winner::text,'null'));
  insert into _t values ('sets 2-0', (st->'sets'->>0)='2', st->'sets'::text);

  -- ---- Тест 6: формат счёта 6-4 2-1 ----
  -- сет1: гейм-победители [1,2,1,2,1,2,1,2,1,1] = 6-4 (каждый гейм = 4 очка победителю)
  init := public._scoring_initial_state(3);
  st := init;
  for g in 1..10 loop
    declare
      side int := case when g in (2,4,6,8) then 2 else 1 end;  -- [1,2,1,2,1,2,1,2,1,1]
    begin
      if g = 10 then side := 1; end if;
      for i in 1..4 loop r:=public._scoring_add_point(st,side); st:=r.state; end loop;
    end;
  end loop;
  -- проверка: после 9 геймов (5 p1, 4 p2) = 5:4, 10-й гейм p1 → 6-4 сет выигран
  -- сет2: [1,2,1] = 2-1
  for g in 1..3 loop
    declare
      side int := case when g = 2 then 2 else 1 end;
    begin
      for i in 1..4 loop r:=public._scoring_add_point(st,side); st:=r.state; end loop;
    end;
  end loop;
  insert into _t values ('score 6-4 2-1', public._scoring_format_score(st)='6-4 2-1', public._scoring_format_score(st));
  insert into _t values ('set won 1-0', (st->'sets'->>0)='1' and (st->'sets'->>1)='0', st->'sets'::text);

  -- ---- Тест 7: undo через replay (отмена последнего очка) ----
  init := public._scoring_initial_state(3);
  -- 2 очка p1: 30-0
  st := init;
  r:=public._scoring_add_point(st,1); st:=r.state;  -- 15
  r:=public._scoring_add_point(st,1); st:=r.state;  -- 30
  -- undo: history [1,1] → [1], replay → должно дать 15
  r := public._scoring_replay(init, array[1]);
  insert into _t values ('undo replay → 15', (r.state->'points'->>0)='15', r.state->'points'->>0);
end $$;

-- ---- Итог ----
select
  case when bool_and(ok) then '✓ ALL PASS' else '✗ SOME FAILED' end as result,
  count(*) filter (where not ok) as failed,
  count(*) as total
from _t;

-- показать упавшие
select name, detail from _t where not ok order by name;

-- выходим с ошибкой, если есть провалы (psql через DO raise не вариант — используем \gset)
do $$
declare
  fails int;
begin
  select count(*) into fails from _t where not ok;
  if fails > 0 then
    raise exception 'ТЕСТЫ SCORING ПРОВАЛЕНЫ: % ошибок', fails;
  end if;
end $$;

\echo 'Scoring RPC: все тесты пройдены'
