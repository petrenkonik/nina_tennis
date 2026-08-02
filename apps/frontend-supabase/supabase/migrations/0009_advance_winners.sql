-- ============================================================================
-- nina_tennis — миграция 0009: авто-выход победителей в следующий раунд
-- ============================================================================
-- Для системы «на вылет» (elimination): переносит победителей раунда N в слоты
-- раунда N+1. Запускается кнопкой админа (идемпотентно — повторный клик
-- пересчитывает из текущих победителей).
--
-- Структура сетки: позиция матча внутри раунда = id ASC (генератор вставляет
-- матчи подряд слева направо). Матч-источник с позицией j раунда R питает цель
-- floor(j/2) раунда R+1: чётный источник → сторона 1 цели, нечётный → сторона 2.
-- (Так же устроен BracketView: mIdx*2 / mIdx*2+1 из предыдущего раунда.)
--
-- BYE-матч (одна сторона null, status='scheduled', winner_id пуст) продвигает
-- ненулевую сторону. Матч за 3-е место (match_kind='third_place') исключается —
-- заполняется вручную. Уже сыгранные цели (status='finished') не трогаются.
-- ============================================================================

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

  -- формат турнира группы (нужен для doubles-партнёров); по умолчанию singles
  select t.format into v_format
  from public.groups g
  left join public.tournaments t on t.id = g.tournament_id
  where g.id = p_group_id;
  if v_format is null then v_format := 'singles'; end if;

  -- Временная таблица: только обычные матчи (без матча за 3-е место) с позицией
  -- внутри раунда (0-индексация) и «эффективным победителем»:
  --   - winner_id, если матч завершён;
  --   - иначе ненулевая сторона (BYE-авто-выход);
  --   - иначе null (матч ещё не сыгран, обе стороны есть).
  drop table if exists pg_temp._adv;
  create temp table _adv as
  select
    id,
    round,
    -- позиция внутри раунда по id ASC (восстанавливает левый-правый порядок сетки)
    row_number() over (partition by round order by id) - 1 as pos,
    player1_id, player2_id, player3_id, player4_id,
    status, winner_id,
    coalesce(
      winner_id,
      case
        when status in ('scheduled','in_progress') and player1_id is not null and player2_id is null
          then player1_id                       -- BYE: есть только сторона 1
        when status in ('scheduled','in_progress') and player1_id is null and player2_id is not null
          then player2_id                       -- BYE: есть только сторона 2
        else null
      end
    ) as eff_winner
  from public.matches
  where group_id = p_group_id and match_kind = 'normal';

  create index on _adv (round, pos);

  -- Один set-based UPDATE: цель (round=R+1, не завершена) join двух источников.
  -- Источник с чётной позицией → сторона 1 цели; с нечётной → сторона 2.
  -- Партнёр (doubles) берётся со стороны победителя: eff_winner = player1_id →
  -- player3_id, иначе player4_id.
  -- Цель join с _adv t, чтобы (а) позиционировать её по pos и (б) гарантировать
  -- что это обычный матч (match_kind='normal', как в _adv).
  update public.matches as tgt
  set
    player1_id = s1.eff_winner,
    player2_id = s2.eff_winner,
    player3_id = case when v_format = 'doubles'
                      then case when s1.eff_winner = s1.player1_id then s1.player3_id
                                when s1.eff_winner = s1.player2_id then s1.player4_id
                                else null end
                      else null end,
    player4_id = case when v_format = 'doubles'
                      then case when s2.eff_winner = s2.player1_id then s2.player3_id
                                when s2.eff_winner = s2.player2_id then s2.player4_id
                                else null end
                      else null end
  from _adv as t, _adv as s1, _adv as s2
  where t.id = tgt.id
    and tgt.group_id = p_group_id
    and tgt.status <> 'finished'
    and s1.round = t.round - 1 and s1.pos = t.pos * 2
    and s2.round = t.round - 1 and s2.pos = t.pos * 2 + 1;

  drop table if exists pg_temp._adv;
end;
$$;

comment on function public.advance_winners(bigint) is
  'Перенос победителей (и BYE-сторон) в слоты следующего раунда сетки на вылет. Только админ.';
