import { createSupabaseServer } from './supabase/server';
import type { AuthUser } from './session';

/**
 * Серверная проверка прав — замена NestJS-гардов (@Roles, JwtAuthGuard, RolesGuard)
 * и TournamentsService.assertCanJudgeMatch.
 *
 * Каждая функция либо ничего не делает (доступ есть), либо бросает PermissionError.
 * Вызывается в начале Server Actions.
 */

export class PermissionError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
    this.name = 'PermissionError';
  }
}

export type SessionUser = AuthUser | null | undefined;

/** Пользователь должен быть авторизован (замена @UseGuards(JwtAuthGuard)). */
export function requireAuth(user: SessionUser): asserts user is AuthUser {
  if (!user) throw new PermissionError('Требуется авторизация', 401);
}

/** Пользователь должен быть админом (замена @Roles('admin')). */
export function requireAdmin(user: SessionUser): asserts user is AuthUser {
  requireAuth(user);
  if (user.role !== 'admin') throw new PermissionError('Требуются права администратора', 403);
}

/**
 * Проверка права судить матч.
 * Перенос TournamentsService.assertCanJudgeMatch:
 *  - admin — всегда OK;
 *  - referee — если он в tournament_referees турнира этого матча
 *    (цепочка: match → group → tournament → referees).
 * Реализовано одним SQL-запросом с join.
 */
export async function assertCanJudgeMatch(
  matchId: string | number,
  user: SessionUser,
): Promise<void> {
  requireAuth(user);
  if (user.role === 'admin') return;

  // Один запрос: матч → группа → турнир → проверка вхождения user_id в referees.
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc('can_user_judge_match', {
    p_match_id: Number(matchId),
    p_user_id: user.id,
  });

  if (error) {
    throw new PermissionError('Не удалось проверить права на матч', 500);
  }
  if (!data) {
    throw new PermissionError('Вы не судья этого турнира', 403);
  }
}
