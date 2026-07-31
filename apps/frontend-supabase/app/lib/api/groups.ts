'use server';

import { createSupabaseServer } from '../supabase/server';
import { requireAdmin } from '../permissions';
import { getCurrentUser } from '../session';
import { generateKnockoutBracket } from '@shared/utils';
import { toPlayer, toMatch } from '../transform';

/**
 * Группы. Замена NestJS GroupsController.
 * Включает генерацию сетки (generateKnockoutBracket из libs/shared — устраняет
 * дублирование, которое было в backend).
 *
 * Парный режим (doubles): единицей турнира является пара (капитан + партнёр).
 * Посев и хранение — отдельными таблицами group_pairs / group_pair_seeds.
 * Скоринг не меняется: он считает по сторонам 1/2.
 */

export interface GroupUI {
  _id: string;
  name: string;
  /** id турнира (alias tournamentId — для совместимости со старым UI). */
  tournamentId?: string | null;
  /** то же в snake_case для внутреннего использования */
  tournament_id?: string | null;
  /** Формат турнира (наследуется от турнира группы). */
  format?: 'singles' | 'doubles';
  players: any[];
  matches: any[];
  seededPlayers?: { playerId: string; seed: number }[];
  /** Пары группы — только для doubles. a — капитан (единица турнира). */
  pairs?: { a: any; b: any; seed?: number }[];
}

/** Узнать формат турнира группы. null, если турнир не задан. */
async function getGroupFormat(groupId: string): Promise<'singles' | 'doubles' | null> {
  const { data: g } = await (await createSupabaseServer())
    .from('groups')
    .select('tournament_id')
    .eq('id', groupId)
    .maybeSingle();
  if (!g?.tournament_id) return null;
  const { data: t } = await (await createSupabaseServer())
    .from('tournaments')
    .select('format')
    .eq('id', g.tournament_id)
    .maybeSingle();
  return t?.format === 'doubles' ? 'doubles' : 'singles';
}

export async function getGroups(): Promise<GroupUI[]> {
  const { data, error } = await (await createSupabaseServer()).from('groups').select('id, name, tournament_id');
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
  const { data: g, error } = await (await createSupabaseServer())
    .from('groups')
    .select('id, name, tournament_id')
    .eq('id', id)
    .maybeSingle();
  if (error || !g) throw new Error('Ошибка загрузки группы');

  const format = await getGroupFormat(id);

  // --- Парный режим: грузим пары + посев пар ---
  if (format === 'doubles') {
    const pairs = await getGroupPairs(id);
    // Для совместимости: players заполняем всеми игроками из пар (для поиска/создания).
    const allPairPlayerIds = new Set<string>();
    for (const p of pairs) {
      if (p.a?._id) allPairPlayerIds.add(String(p.a._id));
      if (p.b?._id) allPairPlayerIds.add(String(p.b._id));
    }
    return {
      _id: String(g.id),
      name: g.name,
      tournamentId: g.tournament_id ? String(g.tournament_id) : null,
      tournament_id: g.tournament_id ? String(g.tournament_id) : null,
      format,
      players: [],
      pairs,
      matches: [],
      seededPlayers: [],
    };
  }

  // --- Одиночный режим: игроки + посев ---
  const { data: gp } = await (await createSupabaseServer())
    .from('group_players')
    .select('player_id')
    .eq('group_id', id);
  const playerIds = (gp || []).map((r) => r.player_id);

  let players: any[] = [];
  if (playerIds.length) {
    const { data: pRows } = await (await createSupabaseServer())
      .from('players')
      .select('id, full_name, birth_year, gender, club, photo_url, rating')
      .in('id', playerIds);
    players = (pRows || []).map((r) => toPlayer(r)).filter(Boolean);
  }

  // Посев группы (seededPlayers) — нужен UI, иначе посев всегда отображается пустым
  const seededPlayers = await getSeededPlayers(id);

  return {
    _id: String(g.id),
    name: g.name,
    tournamentId: g.tournament_id ? String(g.tournament_id) : null,
    tournament_id: g.tournament_id ? String(g.tournament_id) : null,
    format,
    players,
    matches: [],
    seededPlayers,
  };
}

/** Игроки группы (с seed). */
export async function getGroupPlayers(id: string): Promise<any[]> {
  const { data: gp, error } = await (await createSupabaseServer())
    .from('group_players')
    .select('player_id')
    .eq('group_id', id);
  if (error) throw new Error('Ошибка загрузки игроков группы');
  const ids = (gp || []).map((r) => r.player_id);
  if (!ids.length) return [];

  const { data: rows } = await (await createSupabaseServer())
    .from('players')
    .select('id, full_name, birth_year, gender, club, photo_url, rating')
    .in('id', ids);
  return (rows || []).map((r) => toPlayer(r)).filter(Boolean);
}

/** Посеянные игроки группы. */
export async function getSeededPlayers(groupId: string): Promise<{ playerId: string; seed: number }[]> {
  const { data, error } = await (await createSupabaseServer())
    .from('group_seeds')
    .select('player_id, seed')
    .eq('group_id', groupId)
    .order('seed', { ascending: true });
  if (error) throw new Error('Ошибка загрузки посеянных игроков');
  return (data || []).map((r) => ({ playerId: String(r.player_id), seed: r.seed }));
}

// ---- Парный режим (doubles): пары и посев пар ----

/**
 * Пары группы с объектами игроков и seed.
 * a — капитан (единица турнира), b — партнёр.
 */
export async function getGroupPairs(groupId: string): Promise<{ a: any; b: any; seed?: number }[]> {
  const { data: pairRows, error } = await (await createSupabaseServer())
    .from('group_pairs')
    .select('player_a_id, player_b_id')
    .eq('group_id', groupId);
  if (error) throw new Error('Ошибка загрузки пар группы');

  const { data: seedRows } = await (await createSupabaseServer())
    .from('group_pair_seeds')
    .select('player_a_id, seed')
    .eq('group_id', groupId);
  const seedByCaptain = new Map<string, number>();
  for (const s of seedRows || []) seedByCaptain.set(String(s.player_a_id), s.seed);

  // Подтягиваем объекты всех игроков пар одним запросом.
  const ids = new Set<string>();
  for (const r of pairRows || []) {
    ids.add(String(r.player_a_id));
    ids.add(String(r.player_b_id));
  }
  if (!ids.size) return [];

  const { data: playerRows } = await (await createSupabaseServer())
    .from('players')
    .select('id, full_name, birth_year, gender, club, photo_url, rating')
    .in('id', [...ids]);
  const byId = new Map<string, any>();
  for (const r of playerRows || []) byId.set(String(r.id), toPlayer(r));

  return (pairRows || []).map((r) => ({
    a: byId.get(String(r.player_a_id)),
    b: byId.get(String(r.player_b_id)),
    seed: seedByCaptain.get(String(r.player_a_id)),
  })).filter((p) => p.a && p.b);
}

/** Посев пар группы (ключ — капитан пары). */
export async function getGroupPairSeeds(groupId: string): Promise<{ playerId: string; seed: number }[]> {
  const { data, error } = await (await createSupabaseServer())
    .from('group_pair_seeds')
    .select('player_a_id, seed')
    .eq('group_id', groupId)
    .order('seed', { ascending: true });
  if (error) throw new Error('Ошибка загрузки посева пар');
  return (data || []).map((r) => ({ playerId: String(r.player_a_id), seed: r.seed }));
}

export async function createGroup(data: any, _accessToken?: string): Promise<GroupUI> {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { data: row, error } = await (await createSupabaseServer())
    .from('groups')
    .insert({
      name: data.name,
      tournament_id: data.tournament_id ? Number(data.tournament_id) : null,
    })
    .select('id, name, tournament_id')
    .single();
  if (error || !row) throw new Error('Ошибка создания группы');
  return {
    _id: String(row.id),
    name: row.name,
    tournamentId: row.tournament_id ? String(row.tournament_id) : null,
    tournament_id: row.tournament_id ? String(row.tournament_id) : null,
    players: [],
    matches: [],
  };
}

export async function updateGroup(id: string, data: any, _accessToken?: string): Promise<any> {
  const user = await getCurrentUser();
  requireAdmin(user);

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.tournament_id !== undefined) {
    patch.tournament_id = data.tournament_id ? Number(data.tournament_id) : null;
  }

  const { data: row, error } = await (await createSupabaseServer())
    .from('groups')
    .update(patch)
    .eq('id', id)
    .select('id, name, tournament_id')
    .single();
  if (error || !row) throw new Error('Ошибка обновления группы');

  // Синхронизация игроков и посева (если переданы)
  if (Array.isArray(data.players)) {
    await syncGroupPlayers(id, data.players);
  }
  if (Array.isArray(data.seededPlayers)) {
    await syncGroupSeeds(id, data.seededPlayers);
  }
  // Парный режим: пары и посев пар (если переданы)
  if (Array.isArray(data.pairs)) {
    await syncGroupPairs(id, data.pairs);
  }
  if (Array.isArray(data.pairSeeds)) {
    await syncGroupPairSeeds(id, data.pairSeeds);
  }

  return { _id: String(row.id), name: row.name };
}

export async function deleteGroup(id: string, _accessToken?: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { error } = await (await createSupabaseServer()).from('groups').delete().eq('id', id);
  if (error) throw new Error('Ошибка удаления группы');
  return { success: true };
}

// ---- Матчи группы ----

export async function getGroupMatches(groupId: string): Promise<any[]> {
  const { data, error } = await (await createSupabaseServer())
    .from('v_matches_full')
    .select('*')
    .eq('group_id', groupId)
    .order('round', { ascending: true });
  if (error) throw new Error('Ошибка загрузки матчей группы');
  return (data || []).map((r) => toMatch(r)).filter(Boolean);
}

export async function addMatch(groupId: string, data: any, _accessToken?: string): Promise<any> {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { data: row, error } = await (await createSupabaseServer())
    .from('matches')
    .insert({
      group_id: Number(groupId),
      player1_id: data.player1Id != null ? Number(data.player1Id) : null,
      player2_id: data.player2Id != null ? Number(data.player2Id) : null,
      // Партнёры сторон (парный режим) — опционально.
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

export async function deleteMatch(groupId: string, matchId: string, _accessToken?: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { error } = await (await createSupabaseServer()).from('matches').delete().eq('id', matchId);
  if (error) throw new Error('Ошибка удаления матча');
  return { success: true };
}

/**
 * Генерация олимпийской сетки (single elimination, snake-seeding) для группы.
 * Замена GroupsController.generateMatches. Переиспользует generateKnockoutBracket
 * из libs/shared (раньше код дублировался в backend).
 *
 * Парный режим: единицей турнира является пара (капитан). Генератор работает
 * над «единицами» — для пар это объект { _id: captainId, seed, partnerId }.
 * При записи матча капитан стороны 1 → player1_id, партнёр → player3_id;
 * капитан стороны 2 → player2_id, партнёр → player4_id.
 */
export async function generateMatches(groupId: string, _accessToken?: string): Promise<any[]> {
  const user = await getCurrentUser();
  requireAdmin(user);

  const group = await getGroupById(groupId);
  if (!group) throw new Error('Group not found');
  const isDoubles = group.format === 'doubles';

  // Единицы турнира: игрок (singles) или капитан пары с partnerId (doubles).
  let units: any[];
  if (isDoubles) {
    const pairSeeds = await getGroupPairSeeds(groupId);
    units = (group.pairs || []).map((pair: any) => {
      const seedObj = pairSeeds.find((s) => s.playerId === String(pair.a._id));
      return {
        _id: String(pair.a._id),
        seed: seedObj?.seed,
        partnerId: pair.b?._id ? String(pair.b._id) : undefined,
      };
    });
  } else {
    const seeds = await getSeededPlayers(groupId);
    units = group.players.map((p: any) => {
      const seedObj = seeds.find((s) => s.playerId === String(p._id));
      return seedObj ? { ...p, seed: seedObj.seed } : p;
    });
  }

  const rounds = generateKnockoutBracket(units);

  // Удаляем старые матчи группы (каскадно почистит match_judges)
  const { data: old } = await (await createSupabaseServer())
    .from('matches')
    .select('id')
    .eq('group_id', groupId);
  if (old && old.length) {
    await (await createSupabaseServer()).from('matches').delete().in('id', old.map((m) => m.id));
  }

  // Создаём матчи по раундам
  const created: any[] = [];
  for (const round of rounds) {
    for (const m of round) {
      const insertRow: any = {
        group_id: Number(groupId),
        player1_id: m.player1?._id ? Number(m.player1._id) : null,
        player2_id: m.player2?._id ? Number(m.player2._id) : null,
        round: m.round,
        status: 'scheduled',
        court: '',
      };
      // Партнёры сторон — только для парного режима.
      if (isDoubles) {
        insertRow.player3_id = m.player1?.partnerId ? Number(m.player1.partnerId) : null;
        insertRow.player4_id = m.player2?.partnerId ? Number(m.player2.partnerId) : null;
      }
      const { data: row, error } = await (await createSupabaseServer())
        .from('matches')
        .insert(insertRow)
        .select('id')
        .single();
      if (!error && row) created.push(row);
    }
  }

  return getGroupMatches(groupId);
}

// ---- Вспомогательное: синхронизация игроков/посева группы ----

async function syncGroupPlayers(groupId: string, players: any[]) {
  const playerIds = players.map((p: any) => Number(p._id || p));
  // Текущие
  const { data: cur } = await (await createSupabaseServer())
    .from('group_players')
    .select('player_id')
    .eq('group_id', groupId);
  const curIds = new Set((cur || []).map((r) => Number(r.player_id)));
  const newIds = new Set(playerIds);

  const toAdd = playerIds.filter((id) => !curIds.has(id));
  const toRemove = [...curIds].filter((id) => !newIds.has(id));

  if (toAdd.length) {
    (await createSupabaseServer())
      .from('group_players')
      .insert(toAdd.map((player_id) => ({ group_id: Number(groupId), player_id })));
  }
  if (toRemove.length) {
    (await createSupabaseServer())
      .from('group_players')
      .delete()
      .eq('group_id', groupId)
      .in('player_id', toRemove);
  }
}

async function syncGroupSeeds(groupId: string, seededPlayers: { playerId: string; seed: number }[]) {
  // Полная замена посева
  await (await createSupabaseServer()).from('group_seeds').delete().eq('group_id', groupId);
  if (seededPlayers.length) {
    await (await createSupabaseServer()).from('group_seeds').insert(
      seededPlayers.map((s) => ({
        group_id: Number(groupId),
        player_id: Number(s.playerId),
        seed: s.seed,
      })),
    );
  }
}

/**
 * Полная замена пар группы. pairs: [{ aId, bId }] — капитан + партнёр.
 * Конфликт уникальности по капитану (PK) не допускает двух пар на одном капитане.
 */
async function syncGroupPairs(groupId: string, pairs: { aId: string; bId: string }[]) {
  await (await createSupabaseServer()).from('group_pairs').delete().eq('group_id', groupId);
  const valid = pairs.filter((p) => p.aId && p.bId && p.aId !== p.bId);
  if (valid.length) {
    await (await createSupabaseServer()).from('group_pairs').insert(
      valid.map((p) => ({
        group_id: Number(groupId),
        player_a_id: Number(p.aId),
        player_b_id: Number(p.bId),
      })),
    );
  }
}

/** Полная замена посева пар группы (ключ — капитан пары). */
async function syncGroupPairSeeds(groupId: string, seeds: { playerId: string; seed: number }[]) {
  await (await createSupabaseServer()).from('group_pair_seeds').delete().eq('group_id', groupId);
  if (seeds.length) {
    await (await createSupabaseServer()).from('group_pair_seeds').insert(
      seeds.map((s) => ({
        group_id: Number(groupId),
        player_a_id: Number(s.playerId),
        seed: s.seed,
      })),
    );
  }
}
