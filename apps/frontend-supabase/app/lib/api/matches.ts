'use server';

import { createSupabaseServer } from '../supabase/server';
import { assertCanJudgeMatch } from '../permissions';
import { getCurrentUser } from '../session';
import { toMatch } from '../transform';
import {
  createInitialScoringState,
  addPoint,
  formatScore,
  type MatchScoringState,
  type Side,
} from '@shared/scoring';

/**
 * Матчи и скоринг. Замена GroupsController.updateMatch + MatchController.
 * Логика скоринга — чистые функции из libs/shared/scoring (без изменений).
 */

export async function getMatch(id: string) {
  const { data, error } = await (await createSupabaseServer())
    .from('v_matches_full')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) throw new Error('Ошибка загрузки матча');

  const match = toMatch(data);

  // judgedBy — отдельная таблица, подтягиваем с пользователями
  const { data: judges } = await (await createSupabaseServer())
    .from('match_judges')
    .select('user_id, judged_at, profiles!inner(email, first_name, last_name)')
    .eq('match_id', id);
  if (match && judges) {
    match.judgedBy = judges.map((j: any) => ({
      _id: j.user_id,
      email: j.profiles?.email,
      firstName: j.profiles?.first_name,
      lastName: j.profiles?.last_name,
    }));
  }
  return match;
}

export async function getMatches(): Promise<any[]> {
  const { data, error } = await (await createSupabaseServer())
    .from('v_matches_full')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error('Ошибка загрузки матчей');
  return (data || []).map((r) => toMatch(r)).filter(Boolean);
}

/**
 * Обновление матча судьёй/админом.
 * Замена GroupsController.updateMatch. Проверка прав — assertCanJudgeMatch.
 * Если сохраняет referee — фиксируем referee_id и добавляем в match_judges.
 *
 * data может содержать:
 *  - scoring поля: scoringState, pointHistory, score, winnerId, status, serverSide, courtSide
 *  - расписание: scheduledAt, court, round
 */
export async function updateMatch(groupId: string, matchId: string, data: any, _accessToken?: string): Promise<any> {
  const user = await getCurrentUser();
  await assertCanJudgeMatch(matchId, user);

  const patch: Record<string, unknown> = {};
  if (data.score !== undefined) patch.score = data.score;
  if (data.status !== undefined) patch.status = data.status;
  if (data.winnerId !== undefined)
    patch.winner_id = data.winnerId ? Number(data.winnerId) : null;
  if (data.scoringState !== undefined) patch.scoring_state = data.scoringState;
  if (data.pointHistory !== undefined) patch.point_history = data.pointHistory;
  if (data.scheduledAt !== undefined) patch.scheduled_at = data.scheduledAt;
  if (data.playedAt !== undefined) patch.played_at = data.playedAt;
  if (data.court !== undefined) patch.court = data.court;
  if (data.round !== undefined) patch.round = data.round;
  if (data.serverSide !== undefined) patch.server_side = data.serverSide;
  if (data.courtSide !== undefined) {
    patch.court_side_p1 = data.courtSide?.p1 ?? null;
    patch.court_side_p2 = data.courtSide?.p2 ?? null;
  }
  if (data.player1Id !== undefined)
    patch.player1_id = data.player1Id ? Number(data.player1Id) : null;
  if (data.player2Id !== undefined)
    patch.player2_id = data.player2Id ? Number(data.player2Id) : null;

  // Судья, сохраняющий матч, фиксируется (как в backend — для referee).
  if (user && user.role === 'referee' && !data.refereeId) {
    patch.referee_id = user.id;
  } else if (data.refereeId) {
    patch.referee_id = data.refereeId;
  }

  const { error } = await (await createSupabaseServer()).from('matches').update(patch).eq('id', matchId);
  if (error) throw new Error('Ошибка обновления матча');

  // История судейства: добавляем текущего пользователя (идемпотентно).
  // В отличие от backend, фиксируем и админа-судью тоже.
  if (user) {
    (await createSupabaseServer())
      .from('match_judges')
      .upsert({ match_id: Number(matchId), user_id: user.id }, { onConflict: 'match_id,user_id' });
  }

  return getMatch(matchId);
}

/**
 * Обновление скоринга матча одним действием (добавление/удаление очка).
 * Применяет addPoint из libs/shared/scoring, пересчитывает score/winner.
 *
 * @param action 'add' | 'undo'
 * @param winner 1 | 2 (для add)
 */
export async function updateMatchScore(
  matchId: string,
  action: 'add' | 'undo',
  winner?: Side,
): Promise<any> {
  const user = await getCurrentUser();
  await assertCanJudgeMatch(matchId, user);

  // Текущее состояние
  const { data: m, error } = await (await createSupabaseServer())
    .from('matches')
    .select('id, player1_id, player2_id, scoring_state, point_history, status')
    .eq('id', matchId)
    .maybeSingle();
  if (error || !m) throw new Error('Матч не найден');

  let state: MatchScoringState = m.scoring_state || createInitialScoringState();
  let history: number[] = m.point_history || [];

  if (action === 'add' && winner) {
    const result = addPoint(state, winner);
    state = result.state;
    history = [...history, winner];
    const patch: Record<string, unknown> = {
      scoring_state: state,
      point_history: history,
      score: formatScore(state),
    };
    // Определение победителя матча
    if (result.matchOver && result.winner) {
      patch.status = 'finished';
      patch.played_at = new Date().toISOString();
      // winner: player1 (winner=1) или player2 (winner=2)
      patch.winner_id = result.winner === 1 ? m.player1_id : m.player2_id;
    } else {
      patch.status = 'in_progress';
    }
    await (await createSupabaseServer()).from('matches').update(patch).eq('id', matchId);
  } else if (action === 'undo') {
    // Undo: убираем последнее очко и переигрываем оставшуюся историю
    if (history.length === 0) return getMatch(matchId);
    history = history.slice(0, -1);
    // replayFromSides здесь не нужен: пересоздаём из начального и переигрываем
    const { replayFromSides } = await import('@shared/scoring');
    const init = createInitialScoringState(state.bestOf, state.gamesPerSet, state.tiebreakAtDeuce);
    const replayed = replayFromSides(init, history as Side[]);
    state = replayed.state;
    const patch: Record<string, unknown> = {
      scoring_state: state,
      point_history: history,
      score: formatScore(state),
      status: 'in_progress',
      winner_id: null,
    };
    await (await createSupabaseServer()).from('matches').update(patch).eq('id', matchId);
  }

  // Фиксация судьи в истории
  if (user) {
    (await createSupabaseServer())
      .from('match_judges')
      .upsert({ match_id: Number(matchId), user_id: user.id }, { onConflict: 'match_id,user_id' });
  }

  return getMatch(matchId);
}

/** Сброс скоринга матча в начальное состояние. */
export async function resetMatchScore(matchId: string): Promise<any> {
  const user = await getCurrentUser();
  await assertCanJudgeMatch(matchId, user);
  const state = createInitialScoringState();
  const { error } = await (await createSupabaseServer())
    .from('matches')
    .update({
      scoring_state: state,
      point_history: [],
      score: formatScore(state),
      status: 'scheduled',
      winner_id: null,
      played_at: null,
    })
    .eq('id', matchId);
  if (error) throw new Error('Ошибка сброса счёта');
  return getMatch(matchId);
}
