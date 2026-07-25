'use server';

import crypto from 'crypto';
import { createSupabaseServer } from '../supabase/server';
import { requireAdmin, requireAuth } from '../permissions';
import { getCurrentUser } from '../session';

/**
 * Судьи (referees). Замена TournamentsService referee-методов.
 */

/** Сгенерировать многоразовый токен приглашения судей для турнира. */
export async function generateRefereeInvite(id: string, _accessToken?: string): Promise<{ token: string }> {
  const user = await getCurrentUser();
  requireAdmin(user);

  const token = crypto.randomBytes(24).toString('hex');
  const { error } = await (await createSupabaseServer())
    .from('tournaments')
    .update({ referee_invite_token: token })
    .eq('id', id);
  if (error) throw new Error('Ошибка генерации приглашения');
  return { token };
}

/**
 * Принять приглашение: пользователь становится судьёй турнира. Идемпотентно.
 * Замена acceptRefereeInvite: insert в tournament_referees + повышение роли до referee.
 */
export async function acceptRefereeInvite(
  token: string,
  _accessToken?: string,
): Promise<{ tournamentId: string; tournamentName: string; success: boolean }> {
  const user = await getCurrentUser();
  requireAuth(user);

  const { data: tournament, error } = await (await createSupabaseServer())
    .from('tournaments')
    .select('id, name')
    .eq('referee_invite_token', token)
    .maybeSingle();
  if (error || !tournament) {
    const e = new Error('Приглашение недействительно') as Error & { status?: number };
    e.status = 404;
    throw e;
  }

  // Идемпотентный insert
  (await createSupabaseServer())
    .from('tournament_referees')
    .upsert(
      { tournament_id: tournament.id, user_id: user.id },
      { onConflict: 'tournament_id,user_id' },
    );

  // Повышение роли user → referee
  const { data: profile } = await (await createSupabaseServer())
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile && profile.role === 'user') {
    await (await createSupabaseServer()).from('profiles').update({ role: 'referee' }).eq('id', user.id);
  }

  return {
    tournamentId: String(tournament.id),
    tournamentName: tournament.name,
    success: true,
  };
}

/** Список судей турнира с кол-вом отсуженных матчей. */
export async function getTournamentReferees(id: string): Promise<any[]> {
  const { data: refs, error } = await (await createSupabaseServer())
    .from('tournament_referees')
    .select('user_id, profiles!inner(id, email, first_name, last_name, role)')
    .eq('tournament_id', id);
  if (error) throw new Error('Ошибка загрузки судей');

  // Все матчи турнира (для подсчёта отсуженных)
  const { data: groups } = await (await createSupabaseServer())
    .from('groups')
    .select('id')
    .eq('tournament_id', id);
  const groupIds = (groups || []).map((g) => Number(g.id));
  if (!groupIds.length) {
    return (refs || []).map((r: any) => ({
      _id: r.profiles.id,
      id: r.profiles.id,
      email: r.profiles.email,
      firstName: r.profiles.first_name,
      lastName: r.profiles.last_name,
      role: r.profiles.role,
      matchesJudged: 0,
    }));
  }

  const { data: matches } = await (await createSupabaseServer())
    .from('matches')
    .select('id')
    .in('group_id', groupIds);
  const matchIds = (matches || []).map((m) => m.id);

  // Подсчёт по судьям
  const countByUser = new Map<string, number>();
  if (matchIds.length) {
    const { data: judges } = await (await createSupabaseServer())
      .from('match_judges')
      .select('user_id')
      .in('match_id', matchIds);
    for (const j of judges || []) {
      countByUser.set(j.user_id, (countByUser.get(j.user_id) || 0) + 1);
    }
  }

  return (refs || []).map((r: any) => ({
    _id: r.profiles.id,
    id: r.profiles.id,
    email: r.profiles.email,
    firstName: r.profiles.first_name,
    lastName: r.profiles.last_name,
    role: r.profiles.role,
    matchesJudged: countByUser.get(r.profiles.id) || 0,
  }));
}

/** Удалить судью из турнира. */
export async function removeReferee(id: string, userId: string, _accessToken?: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { error } = await (await createSupabaseServer())
    .from('tournament_referees')
    .delete()
    .eq('tournament_id', id)
    .eq('user_id', userId);
  if (error) throw new Error('Ошибка удаления судьи');
  return { success: true };
}
