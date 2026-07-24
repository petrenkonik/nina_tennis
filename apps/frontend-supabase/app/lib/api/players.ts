'use server';

import { supabaseAdmin } from '../supabase/admin';
import { requireAdmin } from '../permissions';
import { getCurrentUser } from '../session';
import { toPlayer, toMatch } from '../transform';

/** Игроки. Замена NestJS PlayersController. */

export async function getPlayers() {
  const { data, error } = await supabaseAdmin
    .from('players')
    .select('id, full_name, birth_year, gender, club, photo_url, rating')
    .order('full_name');
  if (error) throw new Error('Ошибка загрузки игроков');
  return (data || []).map((r) => toPlayer(r)).filter(Boolean);
}

export async function getPlayerById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('players')
    .select('id, full_name, birth_year, gender, club, photo_url, rating')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) throw new Error('Ошибка загрузки игрока');
  return toPlayer(data);
}

/**
 * Все матчи игрока (player1 или player2) — для страницы участника.
 * Замена /players/:id/matches.
 */
export async function getPlayerMatches(id: string) {
  const { data, error } = await supabaseAdmin
    .from('v_matches_full')
    .select('*')
    .or(`player1_id.eq.${id},player2_id.eq.${id}`)
    .order('scheduled_at', { ascending: false });
  if (error) throw new Error('Ошибка загрузки матчей игрока');
  return (data || []).map((r) => toMatch(r)).filter(Boolean);
}

export async function createPlayer(data: any, _accessToken?: string) {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { data: row, error } = await supabaseAdmin
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

export async function updatePlayer(id: string, data: any, _accessToken?: string) {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { data: row, error } = await supabaseAdmin
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

export async function deletePlayer(id: string, _accessToken?: string) {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { error } = await supabaseAdmin.from('players').delete().eq('id', id);
  if (error) throw new Error('Ошибка удаления игрока');
  return { success: true };
}

/**
 * Обновляет photo_url игрока. Используется Route Handler'ом загрузки аватара.
 */
export async function setPlayerPhotoUrl(id: string, photoUrl: string | null) {
  const { error } = await supabaseAdmin
    .from('players')
    .update({ photo_url: photoUrl })
    .eq('id', id);
  if (error) throw new Error('Ошибка обновления фото игрока');
  return { success: true };
}
