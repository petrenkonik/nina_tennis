'use server';

import { createSupabaseServer } from '../supabase/server';
import { requireAdmin, requireAuth } from '../permissions';
import { getCurrentUser } from '../session';
import { toMatch } from '../transform';

/**
 * Турниры. Замена NestJS TournamentsController + TournamentsService.
 * Возвращает объекты в Mongo-стиле (см. transform.ts), чтобы UI не менялся.
 */

export interface TournamentUI {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  clubId?: string;
  groups: any[];
  groupsCount?: number;
  playersCount?: number;
}

/** Список турниров с кол-вом групп/игроков (аналог findAll с агрегацией). */
export async function getTournaments(): Promise<TournamentUI[]> {
  const { data: tournaments, error } = await (await createSupabaseServer())
    .from('tournaments')
    .select('id, name, start_date, end_date, club_id')
    .order('start_date', { ascending: false });
  if (error) throw new Error('Ошибка загрузки турниров');

  // Группы по турнирам
  const { data: groups } = await (await createSupabaseServer())
    .from('groups')
    .select('id, tournament_id');
  const groupsByTournament = new Map<string, string[]>();
  for (const g of groups || []) {
    if (g.tournament_id == null) continue;
    const arr = groupsByTournament.get(String(g.tournament_id)) || [];
    arr.push(String(g.id));
    groupsByTournament.set(String(g.tournament_id), arr);
  }

  // Игроки в группах (для playersCount — уникальные по турниру)
  const allGroupIds = (groups || []).map((g) => String(g.id));
  let playersByGroup = new Map<string, Set<string>>();
  if (allGroupIds.length) {
    const { data: gp } = await (await createSupabaseServer())
      .from('group_players')
      .select('group_id, player_id')
      .in('group_id', allGroupIds);
    for (const r of gp || []) {
      const set = playersByGroup.get(String(r.group_id)) || new Set<string>();
      set.add(String(r.player_id));
      playersByGroup.set(String(r.group_id), set);
    }
  }

  return (tournaments || []).map((t) => {
    const gids = groupsByTournament.get(String(t.id)) || [];
    const uniquePlayers = new Set<string>();
    for (const gid of gids) {
      const set = playersByGroup.get(gid);
      if (set) for (const p of set) uniquePlayers.add(p);
    }
    return {
      _id: String(t.id),
      name: t.name,
      startDate: t.start_date,
      endDate: t.end_date,
      clubId: t.club_id != null ? String(t.club_id) : undefined,
      groups: [],
      groupsCount: gids.length,
      playersCount: uniquePlayers.size,
    };
  });
}

export async function getTournamentById(id: string): Promise<any> {
  const { data: t, error } = await (await createSupabaseServer())
    .from('tournaments')
    .select('id, name, start_date, end_date, club_id')
    .eq('id', id)
    .maybeSingle();
  if (error || !t) throw new Error('Ошибка загрузки турнира');

  // Группы турнира
  const { data: groups } = await (await createSupabaseServer())
    .from('groups')
    .select('id, name')
    .eq('tournament_id', id);

  // Кол-во игроков в каждой группе (для счётчиков на странице групп)
  const groupIds = (groups || []).map((g) => Number(g.id));
  const playersByGroup = new Map<string, number>();
  if (groupIds.length) {
    const { data: gp } = await (await createSupabaseServer())
      .from('group_players')
      .select('group_id')
      .in('group_id', groupIds);
    for (const r of gp || []) {
      playersByGroup.set(
        String(r.group_id),
        (playersByGroup.get(String(r.group_id)) || 0) + 1,
      );
    }
  }

  return {
    _id: String(t.id),
    name: t.name,
    startDate: t.start_date,
    endDate: t.end_date,
    clubId: t.club_id != null ? String(t.club_id) : undefined,
    groups: (groups || []).map((g) => ({
      _id: String(g.id),
      name: g.name,
      players: [],
      playersCount: playersByGroup.get(String(g.id)) || 0,
    })),
  };
}

/**
 * Все матчи турнира (по всем группам) — для календаря/расписания.
 * Замена TournamentsService.findMatches. Использует view v_matches_full.
 */
export async function getTournamentMatches(id: string) {
  // Группы турнира
  const { data: groups, error: gErr } = await (await createSupabaseServer())
    .from('groups')
    .select('id, name')
    .eq('tournament_id', id);
  if (gErr) throw new Error('Ошибка загрузки матчей турнира');
  const groupIds = (groups || []).map((g) => Number(g.id));

  let matches: any[] = [];
  if (groupIds.length) {
    const { data: rows, error } = await (await createSupabaseServer())
      .from('v_matches_full')
      .select('*')
      .in('group_id', groupIds)
      .order('round', { ascending: true });
    if (error) throw new Error('Ошибка загрузки матчей турнира');
    matches = (rows || []).map((r) => toMatch(r)).filter(Boolean);
  }

  return {
    matches,
    groups: (groups || []).map((g) => ({ _id: String(g.id), name: g.name })),
  };
}

export async function createTournament(data: any, _accessToken?: string): Promise<TournamentUI> {
  const user = await getCurrentUser();
  requireAdmin(user);

  const { data: row, error } = await (await createSupabaseServer())
    .from('tournaments')
    .insert({
      name: data.name,
      start_date: data.startDate,
      end_date: data.endDate,
      club_id: data.clubId ? Number(data.clubId) : null,
    })
    .select('id, name, start_date, end_date, club_id')
    .single();
  if (error || !row) throw new Error('Ошибка создания турнира');

  return {
    _id: String(row.id),
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    clubId: row.club_id != null ? String(row.club_id) : undefined,
    groups: [],
  };
}

export async function updateTournament(id: string, data: any, _accessToken?: string): Promise<any> {
  const user = await getCurrentUser();
  requireAdmin(user);

  const { data: row, error } = await (await createSupabaseServer())
    .from('tournaments')
    .update({
      name: data.name,
      start_date: data.startDate,
      end_date: data.endDate,
      club_id: data.clubId != null ? Number(data.clubId) : null,
    })
    .eq('id', id)
    .select('id, name, start_date, end_date, club_id')
    .single();
  if (error || !row) throw new Error('Ошибка обновления турнира');
  return {
    _id: String(row.id),
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    clubId: row.club_id != null ? String(row.club_id) : undefined,
    groups: [],
  };
}

export async function deleteTournament(id: string, _accessToken?: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { error } = await (await createSupabaseServer()).from('tournaments').delete().eq('id', id);
  if (error) throw new Error('Ошибка удаления турнира');
  return { success: true };
}

/**
 * Турнирная сетка группы: раунды с матчами.
 * Замена TournamentsService.getBracket. Формат вывода совместим со старым UI
 * (rounds[].seeds[]: { id, teams[], score, winner, court, status, refereeId, judgedBy }).
 */
export async function getGroupBracket(groupId: string): Promise<{ rounds: any[] }> {
  // Матчи группы + посев
  const supabase = await createSupabaseServer();
  const [{ data: rows }, { data: seeds }] = await Promise.all([
    supabase.from('v_matches_full').select('*').eq('group_id', groupId).order('round', { ascending: true }),
    supabase.from('group_seeds').select('player_id, seed').eq('group_id', groupId),
  ]);

  if (!rows || !rows.length) return { rounds: [] };

  const seedByPlayer = new Map<string, number>();
  for (const s of seeds || []) seedByPlayer.set(String(s.player_id), s.seed);

  const maxRound = Math.max(...rows.map((m: any) => m.round || 1));
  const rounds: any[] = [];
  for (let r = 1; r <= maxRound; r++) {
    const roundMatches = rows.filter((m: any) => (m.round || 1) === r);
    rounds.push({
      title: `Раунд ${r}`,
      seeds: roundMatches.map((m: any) => ({
        id: String(m.id),
        teams: [
          m.player1_id != null
            ? {
                _id: String(m.player1_id),
                fullName: m.player1_name,
                photoUrl: m.player1_photo,
                club: m.player1_club,
                seed: seedByPlayer.get(String(m.player1_id)),
              }
            : { name: 'BYE' },
          m.player2_id != null
            ? {
                _id: String(m.player2_id),
                fullName: m.player2_name,
                photoUrl: m.player2_photo,
                club: m.player2_club,
                seed: seedByPlayer.get(String(m.player2_id)),
              }
            : { name: 'BYE' },
        ],
        score: m.score,
        scheduledAt: m.scheduled_at,
        playedAt: m.played_at,
        winner: m.winner_id != null ? String(m.winner_id) : null,
        court: m.court,
        status: m.status,
        refereeId: m.referee_id,
        judgedBy: [],
      })),
    });
  }
  return { rounds };
}
