'use client';

/**
 * Клиентский слой данных — прямые запросы к Supabase из браузера.
 *
 * Заменяет Next.js Server Actions (app/lib/api/*). RLS проверяет права с
 * publishable-ключом + cookie-сессией (auth.uid()): публичное чтение,
 * запись админом через is_admin(), апдейты матчей рефери через
 * can_user_judge_match. Сложная бизнес-логика — в Postgres RPC (миграция 0004).
 *
 * Сигнатуры функций совпадают со старыми Server Actions, чтобы UI менялся
 * минимально (только импорты). Преобразования snake_case → UI-формат — через
 * transform.ts (toMatch/toPlayer).
 */
import { supabaseBrowser } from './supabase/browser';
import { toPlayer, toMatch } from './transform';
import type { Side, MatchScoringState } from '@shared/scoring';

const sb = supabaseBrowser;

// ----------------------------------------------------------------------------
// Игроки
// ----------------------------------------------------------------------------
export async function getPlayers() {
  const { data, error } = await sb
    .from('players')
    .select('id, full_name, birth_year, gender, club, photo_url, rating')
    .order('full_name');
  if (error) throw new Error('Ошибка загрузки игроков');
  return (data || []).map((r) => toPlayer(r)).filter(Boolean);
}

export async function getPlayerById(id: string) {
  const { data, error } = await sb
    .from('players')
    .select('id, full_name, birth_year, gender, club, photo_url, rating')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) throw new Error('Ошибка загрузки игрока');
  return toPlayer(data);
}

export async function getPlayerMatches(id: string) {
  const { data, error } = await sb
    .from('v_matches_full')
    .select('*')
    .or(`player1_id.eq.${id},player2_id.eq.${id}`)
    .order('scheduled_at', { ascending: false });
  if (error) throw new Error('Ошибка загрузки матчей игрока');
  return (data || []).map((r) => toMatch(r)).filter(Boolean);
}

export async function createPlayer(data: any) {
  const { data: row, error } = await sb
    .from('players')
    .insert({
      full_name: data.fullName,
      birth_year: data.birthYear ?? null,
      gender: data.gender ?? null,
      club: data.club ?? null,
      photo_url: data.photoUrl ?? null,
      rating: data.rating ?? null,
    })
    .select('id, full_name, birth_year, gender, club, photo_url, rating')
    .single();
  if (error || !row) throw new Error('Ошибка создания игрока');
  return toPlayer(row);
}

export async function updatePlayer(id: string, data: any) {
  const { data: row, error } = await sb
    .from('players')
    .update({
      full_name: data.fullName,
      birth_year: data.birthYear ?? null,
      gender: data.gender ?? null,
      club: data.club ?? null,
      photo_url: data.photoUrl ?? null,
      rating: data.rating ?? null,
    })
    .eq('id', id)
    .select('id, full_name, birth_year, gender, club, photo_url, rating')
    .single();
  if (error || !row) throw new Error('Ошибка обновления игрока');
  return toPlayer(row);
}

export async function deletePlayer(id: string) {
  const { error } = await sb.from('players').delete().eq('id', id);
  if (error) throw new Error('Ошибка удаления игрока');
  return { success: true };
}

/** Обновляет photo_url игрока (после загрузки аватара в Storage). */
export async function setPlayerPhotoUrl(id: string, photoUrl: string | null) {
  const { error } = await sb.from('players').update({ photo_url: photoUrl }).eq('id', id);
  if (error) throw new Error('Ошибка обновления фото игрока');
  return { success: true };
}

// ----------------------------------------------------------------------------
// Клубы
// ----------------------------------------------------------------------------
export async function getClubs() {
  const { data, error } = await sb.from('clubs').select('id, name').order('name');
  if (error) throw new Error('Ошибка загрузки клубов');
  return (data || []).map((c) => ({ _id: String(c.id), name: c.name }));
}

export async function createClub(data: { name: string }) {
  const { data: row, error } = await sb.from('clubs').insert({ name: data.name }).select('id, name').single();
  if (error || !row) throw new Error('Ошибка создания клуба');
  return { _id: String(row.id), name: row.name };
}

export async function updateClub(id: string, data: { name: string }) {
  const { data: row, error } = await sb
    .from('clubs')
    .update({ name: data.name })
    .eq('id', id)
    .select('id, name')
    .single();
  if (error || !row) throw new Error('Ошибка обновления клуба');
  return { _id: String(row.id), name: row.name };
}

export async function deleteClub(id: string) {
  const { error } = await sb.from('clubs').delete().eq('id', id);
  if (error) throw new Error('Ошибка удаления клуба');
  return { success: true };
}

// ----------------------------------------------------------------------------
// Турниры
// ----------------------------------------------------------------------------
export async function getTournaments() {
  const { data: tournaments, error } = await sb
    .from('tournaments')
    .select('id, name, start_date, end_date, club_id, format, system')
    .order('start_date', { ascending: false });
  if (error) throw new Error('Ошибка загрузки турниров');

  const { data: groups } = await sb.from('groups').select('id, tournament_id');
  const groupsByTournament = new Map<string, string[]>();
  const allGroupIds: string[] = [];
  for (const g of groups || []) {
    if (g.tournament_id == null) continue;
    const arr = groupsByTournament.get(String(g.tournament_id)) || [];
    arr.push(String(g.id));
    groupsByTournament.set(String(g.tournament_id), arr);
    allGroupIds.push(String(g.id));
  }

  const playersByGroup = new Map<string, Set<string>>();
  if (allGroupIds.length) {
    const { data: gp } = await sb.from('group_players').select('group_id, player_id').in('group_id', allGroupIds);
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
      format: (t.format as 'singles' | 'doubles') || 'singles',
      system: (t.system as 'elimination' | 'round_robin') || 'elimination',
      groups: [],
      groupsCount: gids.length,
      playersCount: uniquePlayers.size,
    };
  });
}

export async function getTournamentById(id: string) {
  const { data: t, error } = await sb
    .from('tournaments')
    .select('id, name, start_date, end_date, club_id, format, system')
    .eq('id', id)
    .maybeSingle();
  if (error || !t) throw new Error('Ошибка загрузки турнира');

  const { data: groups } = await sb.from('groups').select('id, name, system').eq('tournament_id', id);
  const format: 'singles' | 'doubles' = t.format === 'doubles' ? 'doubles' : 'singles';

  const groupIds = (groups || []).map((g) => Number(g.id));
  const playersByGroup = new Map<string, number>();
  if (groupIds.length) {
    // singles — число строк group_players (по игроку на группу);
    // doubles — число строк group_pairs (по паре на группу).
    const { data: gp } = format === 'doubles'
      ? await sb.from('group_pairs').select('group_id').in('group_id', groupIds)
      : await sb.from('group_players').select('group_id').in('group_id', groupIds);
    for (const r of gp || []) {
      playersByGroup.set(String(r.group_id), (playersByGroup.get(String(r.group_id)) || 0) + 1);
    }
  }

  return {
    _id: String(t.id),
    name: t.name,
    startDate: t.start_date,
    endDate: t.end_date,
    clubId: t.club_id != null ? String(t.club_id) : undefined,
    format,
    system: (t.system as 'elimination' | 'round_robin') || 'elimination',
    groups: (groups || []).map((g) => ({
      _id: String(g.id),
      name: g.name,
      system: g.system === 'round_robin' ? 'round_robin' : 'elimination',
      players: [],
      matches: [],
      playersCount: playersByGroup.get(String(g.id)) || 0,
    })),
  };
}

export async function getTournamentMatches(id: string) {
  const { data: groups, error: gErr } = await sb.from('groups').select('id, name').eq('tournament_id', id);
  if (gErr) throw new Error('Ошибка загрузки матчей турнира');
  const groupIds = (groups || []).map((g) => Number(g.id));

  let matches: any[] = [];
  if (groupIds.length) {
    const { data: rows, error } = await sb
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

export async function createTournament(data: any) {
  const { data: row, error } = await sb
    .from('tournaments')
    .insert({
      name: data.name,
      start_date: data.startDate,
      end_date: data.endDate,
      club_id: data.clubId ? Number(data.clubId) : null,
      format: data.format === 'doubles' ? 'doubles' : 'singles',
      system: data.system === 'round_robin' ? 'round_robin' : 'elimination',
    })
    .select('id, name, start_date, end_date, club_id, format, system')
    .single();
  if (error || !row) throw new Error('Ошибка создания турнира');
  return {
    _id: String(row.id),
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    clubId: row.club_id != null ? String(row.club_id) : undefined,
    format: (row.format as 'singles' | 'doubles') || 'singles',
    system: (row.system as 'elimination' | 'round_robin') || 'elimination',
    groups: [],
  };
}

export async function updateTournament(id: string, data: any) {
  const { data: row, error } = await sb
    .from('tournaments')
    .update({
      name: data.name,
      start_date: data.startDate,
      end_date: data.endDate,
      club_id: data.clubId != null ? Number(data.clubId) : null,
      format: data.format === 'doubles' ? 'doubles' : 'singles',
      system: data.system === 'round_robin' ? 'round_robin' : 'elimination',
    })
    .eq('id', id)
    .select('id, name, start_date, end_date, club_id, format, system')
    .single();
  if (error || !row) throw new Error('Ошибка обновления турнира');
  return {
    _id: String(row.id),
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    clubId: row.club_id != null ? String(row.club_id) : undefined,
    format: (row.format as 'singles' | 'doubles') || 'singles',
    system: (row.system as 'elimination' | 'round_robin') || 'elimination',
    groups: [],
  };
}

export async function deleteTournament(id: string) {
  const { error } = await sb.from('tournaments').delete().eq('id', id);
  if (error) throw new Error('Ошибка удаления турнира');
  return { success: true };
}

// ----------------------------------------------------------------------------
// Группы
// ----------------------------------------------------------------------------
export interface GroupUI {
  _id: string;
  name: string;
  tournamentId?: string | null;
  tournament_id?: string | null;
  format?: 'singles' | 'doubles';
  system?: 'elimination' | 'round_robin';
  players: any[];
  matches: any[];
  seededPlayers?: { playerId: string; seed: number }[];
  pairs?: { a: any; b: any; seed?: number }[];
}

/** Метаданные группы: формат с турнира, система проведения — с группы. */
async function getGroupMeta(
  groupId: string,
): Promise<{ format: 'singles' | 'doubles'; system: 'elimination' | 'round_robin' } | null> {
  const { data: g } = await sb.from('groups').select('tournament_id, system').eq('id', groupId).maybeSingle();
  if (!g) return null;
  const tournamentId = g.tournament_id;
  let format: 'singles' | 'doubles' = 'singles';
  if (tournamentId) {
    const { data: t } = await sb.from('tournaments').select('format').eq('id', tournamentId).maybeSingle();
    if (t?.format === 'doubles') format = 'doubles';
  }
  return {
    format,
    system: g.system === 'round_robin' ? 'round_robin' : 'elimination',
  };
}

/** Обратная совместимость: только формат. */
async function getGroupFormat(groupId: string): Promise<'singles' | 'doubles' | null> {
  const meta = await getGroupMeta(groupId);
  return meta ? meta.format : null;
}

export async function getGroups(): Promise<GroupUI[]> {
  const { data, error } = await sb.from('groups').select('id, name, tournament_id');
  if (error) throw new Error('Ошибка загрузки групп');
  return (data || []).map((g) => ({
    _id: String(g.id),
    name: g.name,
    tournamentId: g.tournament_id ? String(g.tournament_id) : null,
    tournament_id: g.tournament_id ? String(g.tournament_id) : null,
    players: [],
    matches: [],
  }));
}

export async function getGroupById(id: string): Promise<GroupUI | null> {
  const { data: g, error } = await sb.from('groups').select('id, name, tournament_id').eq('id', id).maybeSingle();
  if (error || !g) throw new Error('Ошибка загрузки группы');

  const meta = await getGroupMeta(id);
  const format = meta?.format ?? 'singles';
  const system = meta?.system ?? 'elimination';

  if (format === 'doubles') {
    const pairs = await getGroupPairs(id);
    return {
      _id: String(g.id),
      name: g.name,
      tournamentId: g.tournament_id ? String(g.tournament_id) : null,
      tournament_id: g.tournament_id ? String(g.tournament_id) : null,
      format,
      system,
      players: [],
      pairs,
      matches: [],
      seededPlayers: [],
    };
  }

  const { data: gp } = await sb.from('group_players').select('player_id').eq('group_id', id);
  const playerIds = (gp || []).map((r) => r.player_id);

  let players: any[] = [];
  if (playerIds.length) {
    const { data: pRows } = await sb
      .from('players')
      .select('id, full_name, birth_year, gender, club, photo_url, rating')
      .in('id', playerIds);
    players = (pRows || []).map((r) => toPlayer(r)).filter(Boolean);
  }

  const seededPlayers = await getSeededPlayers(id);
  return {
    _id: String(g.id),
    name: g.name,
    tournamentId: g.tournament_id ? String(g.tournament_id) : null,
    tournament_id: g.tournament_id ? String(g.tournament_id) : null,
    format,
    system,
    players,
    matches: [],
    seededPlayers,
  };
}

export async function getGroupPlayers(id: string): Promise<any[]> {
  const { data: gp, error } = await sb.from('group_players').select('player_id').eq('group_id', id);
  if (error) throw new Error('Ошибка загрузки игроков группы');
  const ids = (gp || []).map((r) => r.player_id);
  if (!ids.length) return [];
  const { data: rows } = await sb
    .from('players')
    .select('id, full_name, birth_year, gender, club, photo_url, rating')
    .in('id', ids);
  return (rows || []).map((r) => toPlayer(r)).filter(Boolean);
}

export async function getSeededPlayers(groupId: string): Promise<{ playerId: string; seed: number }[]> {
  const { data, error } = await sb
    .from('group_seeds')
    .select('player_id, seed')
    .eq('group_id', groupId)
    .order('seed', { ascending: true });
  if (error) throw new Error('Ошибка загрузки посеянных игроков');
  return (data || []).map((r) => ({ playerId: String(r.player_id), seed: r.seed }));
}

export async function getGroupPairs(groupId: string): Promise<{ a: any; b: any; seed?: number }[]> {
  const { data: pairRows, error } = await sb.from('group_pairs').select('player_a_id, player_b_id').eq('group_id', groupId);
  if (error) throw new Error('Ошибка загрузки пар группы');

  const { data: seedRows } = await sb.from('group_pair_seeds').select('player_a_id, seed').eq('group_id', groupId);
  const seedByCaptain = new Map<string, number>();
  for (const s of seedRows || []) seedByCaptain.set(String(s.player_a_id), s.seed);

  const ids = new Set<string>();
  for (const r of pairRows || []) {
    ids.add(String(r.player_a_id));
    ids.add(String(r.player_b_id));
  }
  if (!ids.size) return [];

  const { data: playerRows } = await sb
    .from('players')
    .select('id, full_name, birth_year, gender, club, photo_url, rating')
    .in('id', [...ids]);
  const byId = new Map<string, any>();
  for (const r of playerRows || []) byId.set(String(r.id), toPlayer(r));

  return (pairRows || [])
    .map((r) => ({
      a: byId.get(String(r.player_a_id)),
      b: byId.get(String(r.player_b_id)),
      seed: seedByCaptain.get(String(r.player_a_id)),
    }))
    .filter((p) => p.a && p.b);
}

export async function getGroupPairSeeds(groupId: string): Promise<{ playerId: string; seed: number }[]> {
  const { data, error } = await sb
    .from('group_pair_seeds')
    .select('player_a_id, seed')
    .eq('group_id', groupId)
    .order('seed', { ascending: true });
  if (error) throw new Error('Ошибка загрузки посева пар');
  return (data || []).map((r) => ({ playerId: String(r.player_a_id), seed: r.seed }));
}

export async function createGroup(data: any): Promise<GroupUI> {
  // system может быть задан явно; иначе наследуется от турнира триггером.
  // tournament_id принимаем в обоих написаниях (tournamentId / tournament_id).
  const tournamentId = data.tournamentId ?? data.tournament_id;
  const insert: Record<string, unknown> = {
    name: data.name,
    tournament_id: tournamentId ? Number(tournamentId) : null,
  };
  if (data.system === 'round_robin' || data.system === 'elimination') {
    insert.system = data.system;
  }
  const { data: row, error } = await sb
    .from('groups')
    .insert(insert)
    .select('id, name, tournament_id, system')
    .single();
  if (error || !row) throw new Error('Ошибка создания группы');
  return {
    _id: String(row.id),
    name: row.name,
    tournamentId: row.tournament_id ? String(row.tournament_id) : null,
    tournament_id: row.tournament_id ? String(row.tournament_id) : null,
    system: row.system === 'round_robin' ? 'round_robin' : 'elimination',
    players: [],
    matches: [],
  };
}

/**
 * Атомарное обновление группы + состава/посева/пар через RPC update_group_full.
 * Замена старого updateGroup + 4 sync* (неатомарных).
 */
export async function updateGroup(id: string, data: any): Promise<{ _id: string; name: string }> {
  // Сериализация массивов в jsonb для RPC (NULL = «не менять»).
  const players: number[] | null = Array.isArray(data.players)
    ? data.players.map((p: any) => Number(p._id || p))
    : null;
  const seeds: object[] | null = Array.isArray(data.seededPlayers)
    ? data.seededPlayers.map((s: any) => ({ player_id: Number(s.playerId), seed: s.seed }))
    : null;
  const pairs: object[] | null = Array.isArray(data.pairs)
    ? data.pairs.map((p: any) => ({ a_id: Number(p.aId), b_id: Number(p.bId) }))
    : null;
  const pairSeeds: object[] | null = Array.isArray(data.pairSeeds)
    ? data.pairSeeds.map((s: any) => ({ player_a_id: Number(s.playerId), seed: s.seed }))
    : null;

  const tournamentId = data.tournament_id ?? data.tournamentId;
  const { error } = await sb.rpc('update_group_full', {
    p_id: Number(id),
    p_name: data.name ?? null,
    p_tournament_id: tournamentId != null ? (tournamentId ? Number(tournamentId) : null) : null,
    p_system: data.system === 'round_robin' || data.system === 'elimination' ? data.system : null,
    p_players: players,
    p_seeds: seeds,
    p_pairs: pairs,
    p_pair_seeds: pairSeeds,
  });
  if (error) throw new Error('Ошибка обновления группы');
  return { _id: String(id), name: data.name };
}

export async function deleteGroup(id: string): Promise<{ success: boolean }> {
  const { error } = await sb.from('groups').delete().eq('id', id);
  if (error) throw new Error('Ошибка удаления группы');
  return { success: true };
}

export async function getGroupMatches(groupId: string): Promise<any[]> {
  const { data, error } = await sb
    .from('v_matches_full')
    .select('*')
    .eq('group_id', groupId)
    .order('round', { ascending: true });
  if (error) throw new Error('Ошибка загрузки матчей группы');
  return (data || []).map((r) => toMatch(r)).filter(Boolean);
}

export async function addMatch(groupId: string, data: any): Promise<any> {
  const { data: row, error } = await sb
    .from('matches')
    .insert({
      group_id: Number(groupId),
      player1_id: data.player1Id != null ? Number(data.player1Id) : null,
      player2_id: data.player2Id != null ? Number(data.player2Id) : null,
      player3_id: data.player3Id != null ? Number(data.player3Id) : null,
      player4_id: data.player4Id != null ? Number(data.player4Id) : null,
      score: data.score ?? null,
      status: data.status ?? 'scheduled',
      round: data.round ?? null,
      court: data.court ?? '',
      scheduled_at: data.scheduledAt ?? null,
    })
    .select('id')
    .single();
  if (error || !row) throw new Error('Ошибка добавления матча');
  return { _id: String(row.id) };
}

export async function deleteMatch(groupId: string, matchId: string): Promise<{ success: boolean }> {
  const { error } = await sb.from('matches').delete().eq('id', matchId);
  if (error) throw new Error('Ошибка удаления матча');
  return { success: true };
}

/** Генерация сетки через RPC generate_group_matches (атомарно). */
export async function generateMatches(groupId: string): Promise<any[]> {
  const { error } = await sb.rpc('generate_group_matches', { p_group_id: Number(groupId) });
  if (error) throw new Error('Ошибка генерации сетки');
  return getGroupMatches(groupId);
}

// ----------------------------------------------------------------------------
// Турнирная сетка (read + reshape для UI)
//   rounds    — основное бинарное дерево сетки (матчи match_kind='normal').
//   thirdPlace — отдельный матч за 3-е место (match_kind='third_place'), если есть;
//                рисуется BracketView вне дерева, т.к. он питается проигравшими,
//                а не победителями полуфиналов.
// ----------------------------------------------------------------------------
export interface BracketResult {
  rounds: any[];
  thirdPlace?: any;
}

/** Человекочитаемое название раунда сетки (Финал / Полуфиналы / 1/4 …). */
function roundTitle(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round; // 0 — финал, 1 — полуфиналы, …
  const matchesInRound = 2 ** fromFinal;
  if (matchesInRound === 1) return 'Финал';
  if (matchesInRound === 2) return 'Полуфиналы';
  if (matchesInRound === 4) return '1/4 финала';
  if (matchesInRound === 8) return '1/8 финала';
  return `Раунд ${round}`;
}

export async function getGroupBracket(groupId: string): Promise<BracketResult> {
  const meta = await getGroupMeta(groupId);
  const isDoubles = meta?.format === 'doubles';

  const seedsSource = isDoubles
    ? sb.from('group_pair_seeds').select('player_a_id, seed').eq('group_id', groupId)
    : sb.from('group_seeds').select('player_id, seed').eq('group_id', groupId);

  const [{ data: rows }, { data: seeds }] = await Promise.all([
    sb.from('v_matches_full').select('*').eq('group_id', groupId).order('round', { ascending: true }),
    seedsSource,
  ]);

  if (!rows || !rows.length) return { rounds: [] };

  const seedByPlayer = new Map<string, number>();
  for (const s of seeds || []) {
    if (isDoubles) seedByPlayer.set(String((s as any).player_a_id), (s as any).seed);
    else seedByPlayer.set(String((s as any).player_id), (s as any).seed);
  }

  const buildSide = (
    captainId: any, name: any, photo: any, club: any,
    partnerId: any, partnerName: any, partnerPhoto: any, partnerClub: any,
  ) => {
    if (captainId == null) return { name: 'BYE' };
    const side: any = {
      _id: String(captainId),
      fullName: name,
      photoUrl: photo,
      club,
      seed: seedByPlayer.get(String(captainId)),
    };
    if (isDoubles && partnerId != null) {
      side.partner = {
        _id: String(partnerId),
        fullName: partnerName,
        photoUrl: partnerPhoto,
        club: partnerClub,
      };
    }
    return side;
  };

  const toBracketMatch = (m: any) => ({
    id: String(m.id),
    teams: [
      buildSide(m.player1_id, m.player1_name, m.player1_photo, m.player1_club, m.player3_id, m.player3_name, m.player3_photo, m.player3_club),
      buildSide(m.player2_id, m.player2_name, m.player2_photo, m.player2_club, m.player4_id, m.player4_name, m.player4_photo, m.player4_club),
    ],
    score: m.score,
    scheduledAt: m.scheduled_at,
    playedAt: m.played_at,
    winner: m.winner_id != null ? String(m.winner_id) : null,
    court: m.court,
    status: m.status,
    refereeId: m.referee_id,
    judgedBy: [],
  });

  // Матч за 3-е место — отдельной карточкой, в дерево не входит.
  const thirdPlaceRow = rows.find((m: any) => m.match_kind === 'third_place');
  const treeRows = rows.filter((m: any) => m.match_kind !== 'third_place');

  const maxRound = treeRows.reduce((mx: number, m: any) => Math.max(mx, m.round || 1), 0);
  const rounds: any[] = [];
  for (let r = 1; r <= maxRound; r++) {
    const roundMatches = treeRows.filter((m: any) => (m.round || 1) === r);
    if (!roundMatches.length) continue;
    rounds.push({
      title: roundTitle(r, maxRound),
      seeds: roundMatches.map(toBracketMatch),
    });
  }

  const result: BracketResult = { rounds };
  if (thirdPlaceRow) result.thirdPlace = toBracketMatch(thirdPlaceRow);
  return result;
}

// ----------------------------------------------------------------------------
// Турнирная таблица круговой системы
// ----------------------------------------------------------------------------
export async function getGroupStandings(groupId: string): Promise<any[]> {
  const { data, error } = await sb.rpc('get_group_standings', { p_group_id: Number(groupId) });
  if (error) throw new Error('Ошибка загрузки турнирной таблицы');
  return (data || []).map((r: any) => ({
    unitId: r.unit_id != null ? String(r.unit_id) : undefined,
    player: {
      _id: String(r.unit_id),
      fullName: r.name || '',
      photoUrl: r.photo_url || undefined,
      club: r.club || undefined,
    },
    partner: r.partner_id != null
      ? { _id: String(r.partner_id), fullName: r.partner_name || '' }
      : undefined,
    matchesPlayed: r.matches_played,
    wins: r.wins,
    losses: r.losses,
    setsWon: r.sets_won,
    setsLost: r.sets_lost,
    gamesWon: r.games_won,
    gamesLost: r.games_lost,
    points: r.points,
    position: r.position,
  }));
}

// ----------------------------------------------------------------------------
// Матчи и скоринг
// ----------------------------------------------------------------------------
export async function getMatch(id: string) {
  const { data, error } = await sb.from('v_matches_full').select('*').eq('id', id).maybeSingle();
  if (error || !data) throw new Error('Ошибка загрузки матча');

  const match = toMatch(data);

  const { data: judges } = await sb
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
  const { data, error } = await sb.from('v_matches_full').select('*').order('created_at', { ascending: false });
  if (error) throw new Error('Ошибка загрузки матчей');
  return (data || []).map((r) => toMatch(r)).filter(Boolean);
}

/** Обновление матча произвольным патчем через RPC update_match_admin. */
export async function updateMatch(
  groupId: string,
  matchId: string,
  data: any,
): Promise<any> {
  const patch: Record<string, unknown> = {};
  if (data.score !== undefined) patch.score = data.score;
  if (data.status !== undefined) patch.status = data.status;
  if (data.winnerId !== undefined) patch.winnerId = data.winnerId ? Number(data.winnerId) : null;
  if (data.scoringState !== undefined) patch.scoringState = data.scoringState;
  if (data.pointHistory !== undefined) patch.pointHistory = data.pointHistory;
  if (data.scheduledAt !== undefined) patch.scheduledAt = data.scheduledAt;
  if (data.playedAt !== undefined) patch.playedAt = data.playedAt;
  if (data.court !== undefined) patch.court = data.court;
  if (data.round !== undefined) patch.round = data.round;
  if (data.serverSide !== undefined) patch.serverSide = data.serverSide;
  if (data.courtSide !== undefined) patch.courtSide = data.courtSide;
  if (data.player1Id !== undefined) patch.player1Id = data.player1Id ? Number(data.player1Id) : null;
  if (data.player2Id !== undefined) patch.player2Id = data.player2Id ? Number(data.player2Id) : null;
  if (data.player3Id !== undefined) patch.player3Id = data.player3Id ? Number(data.player3Id) : null;
  if (data.player4Id !== undefined) patch.player4Id = data.player4Id ? Number(data.player4Id) : null;
  if (data.refereeId !== undefined) patch.refereeId = data.refereeId;

  const { data: row, error } = await sb.rpc('update_match_admin', {
    p_match_id: Number(matchId),
    p_patch: patch,
  });
  if (error) throw new Error('Ошибка обновления матча');
  return row && row.length ? toMatch(row[0]) : getMatch(matchId);
}

/**
 * Судейство матча одним действием (add/undo) через RPC score_match_point.
 * Атомарно: SELECT FOR UPDATE + пересчёт + UPDATE + upsert match_judges.
 */
export async function updateMatchScore(matchId: string, action: 'add' | 'undo', winner?: Side): Promise<any> {
  const { data: row, error } = await sb.rpc('score_match_point', {
    p_match_id: Number(matchId),
    p_action: action,
    p_winner: winner ?? null,
  });
  if (error) throw new Error('Ошибка обновления счёта');
  return row && row.length ? toMatch(row[0]) : getMatch(matchId);
}

/** Сброс скоринга через RPC score_match_point (action='reset'). */
export async function resetMatchScore(matchId: string): Promise<any> {
  const { data: row, error } = await sb.rpc('score_match_point', {
    p_match_id: Number(matchId),
    p_action: 'reset',
    p_winner: null,
  });
  if (error) throw new Error('Ошибка сброса счёта');
  return row && row.length ? toMatch(row[0]) : getMatch(matchId);
}

// ----------------------------------------------------------------------------
// Судьи (referees)
// ----------------------------------------------------------------------------
/** Генерация токена приглашения через RPC generate_referee_invite. */
export async function generateRefereeInvite(id: string): Promise<{ token: string }> {
  const { data: token, error } = await sb.rpc('generate_referee_invite', { p_tournament_id: Number(id) });
  if (error) throw new Error('Ошибка генерации приглашения');
  return { token };
}

/** Принятие приглашения судьёй через RPC accept_referee_invite. */
export async function acceptRefereeInvite(token: string): Promise<{ tournamentId: string; tournamentName: string; success: boolean }> {
  const { data: row, error } = await sb.rpc('accept_referee_invite', { p_token: token });
  if (error) {
    const e = new Error('Приглашение недействительно') as Error & { status?: number };
    e.status = 404;
    throw e;
  }
  const r = row && row[0];
  return {
    tournamentId: String(r.tournament_id),
    tournamentName: r.tournament_name,
    success: true,
  };
}

export async function getTournamentReferees(id: string): Promise<any[]> {
  const { data: refs, error } = await sb
    .from('tournament_referees')
    .select('user_id, profiles!inner(id, email, first_name, last_name, role)')
    .eq('tournament_id', id);
  if (error) throw new Error('Ошибка загрузки судей');

  const { data: groups } = await sb.from('groups').select('id').eq('tournament_id', id);
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

  const { data: matches } = await sb.from('matches').select('id').in('group_id', groupIds);
  const matchIds = (matches || []).map((m) => m.id);

  const countByUser = new Map<string, number>();
  if (matchIds.length) {
    const { data: judges } = await sb.from('match_judges').select('user_id').in('match_id', matchIds);
    for (const j of judges || []) countByUser.set(j.user_id, (countByUser.get(j.user_id) || 0) + 1);
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

export async function removeReferee(id: string, userId: string): Promise<{ success: boolean }> {
  const { error } = await sb.from('tournament_referees').delete().eq('tournament_id', id).eq('user_id', userId);
  if (error) throw new Error('Ошибка удаления судьи');
  return { success: true };
}

// ----------------------------------------------------------------------------
// Пользователи / профиль
// ----------------------------------------------------------------------------
export interface UserUI {
  _id: string;
  id: string;
  email: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
}

export async function getMyProfile(): Promise<UserUI> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('Требуется авторизация');
  const { data, error } = await sb
    .from('profiles')
    .select('id, email, role, first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) throw new Error('Ошибка загрузки профиля');
  return {
    _id: data.id,
    id: data.id,
    email: data.email,
    role: data.role,
    firstName: data.first_name,
    lastName: data.last_name,
  };
}

/** Регистрация нового пользователя (первый — admin, назначается триггером БД). */
export async function createUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<UserUI> {
  const { data, error } = await sb.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { first_name: input.firstName, last_name: input.lastName } },
  });
  if (error || !data.user) throw new Error(error?.message || 'Ошибка регистрации');
  const { data: profile } = await sb.from('profiles').select('role, first_name, last_name').eq('id', data.user.id).maybeSingle();
  return {
    _id: data.user.id,
    id: data.user.id,
    email: input.email,
    role: profile?.role || 'user',
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
  };
}

/** Обновление собственного профиля. Имя — в profiles; email/пароль — через Auth. */
export async function updateMyProfile(
  data: { firstName?: string; lastName?: string; email?: string; password?: string },
): Promise<UserUI> {
  if (data.email || data.password) {
    const { error: authErr } = await sb.auth.updateUser({
      ...(data.email ? { email: data.email } : {}),
      ...(data.password ? { password: data.password } : {}),
    });
    if (authErr) {
      const e = new Error(authErr.message || 'Ошибка обновления') as Error & { status?: number };
      e.status = 409;
      throw e;
    }
  }
  const patch: Record<string, unknown> = {};
  if (data.firstName !== undefined) patch.first_name = data.firstName;
  if (data.lastName !== undefined) patch.last_name = data.lastName;
  if (Object.keys(patch).length) {
    const { error } = await sb.from('profiles').update(patch).eq('id', (await sb.auth.getUser()).data.user?.id);
    if (error) throw new Error('Ошибка обновления профиля');
  }
  return getMyProfile();
}

/** Обновление пользователя администратором (имя, фамилия). */
export async function updateUser(id: string, data: { firstName?: string; lastName?: string }): Promise<UserUI> {
  const patch: Record<string, unknown> = {};
  if (data.firstName !== undefined) patch.first_name = data.firstName;
  if (data.lastName !== undefined) patch.last_name = data.lastName;
  const { data: row, error } = await sb
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select('id, email, role, first_name, last_name')
    .single();
  if (error || !row) throw new Error('Ошибка обновления пользователя');
  return {
    _id: row.id,
    id: row.id,
    email: row.email,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
  };
}
