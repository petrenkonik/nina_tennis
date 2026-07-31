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
 */

export interface GroupUI {
  _id: string;
  name: string;
  /** id турнира (alias tournamentId — для совместимости со старым UI). */
  tournamentId?: string | null;
  /** то же в snake_case для внутреннего использования */
  tournament_id?: string | null;
  players: any[];
  matches: any[];
  seededPlayers?: { playerId: string; seed: number }[];
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

  // Игроки группы
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
 */
export async function generateMatches(groupId: string, _accessToken?: string): Promise<any[]> {
  const user = await getCurrentUser();
  requireAdmin(user);

  const group = await getGroupById(groupId);
  if (!group) throw new Error('Group not found');
  const seeds = await getSeededPlayers(groupId);

  // Игроки с seed
  const playersWithSeed = group.players.map((p: any) => {
    const seedObj = seeds.find((s) => s.playerId === String(p._id));
    return seedObj ? { ...p, seed: seedObj.seed } : p;
  });

  const rounds = generateKnockoutBracket(playersWithSeed);

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
      const { data: row, error } = await (await createSupabaseServer())
        .from('matches')
        .insert({
          group_id: Number(groupId),
          player1_id: m.player1?._id ? Number(m.player1._id) : null,
          player2_id: m.player2?._id ? Number(m.player2._id) : null,
          round: m.round,
          status: 'scheduled',
          court: '',
        })
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
