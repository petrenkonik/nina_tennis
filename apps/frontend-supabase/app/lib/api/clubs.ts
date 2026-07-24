'use server';

import { supabaseAdmin } from '../supabase/admin';
import { requireAdmin } from '../permissions';
import { getCurrentUser } from '../session';

/** Клубы. Замена NestJS ClubsController. */

export async function getClubs() {
  const { data, error } = await supabaseAdmin
    .from('clubs')
    .select('id, name')
    .order('name');
  if (error) throw new Error('Ошибка загрузки клубов');
  return (data || []).map((c) => ({ _id: String(c.id), name: c.name }));
}

export async function createClub(data: { name: string }, _accessToken?: string) {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { data: row, error } = await supabaseAdmin
    .from('clubs')
    .insert({ name: data.name })
    .select('id, name')
    .single();
  if (error || !row) throw new Error('Ошибка создания клуба');
  return { _id: String(row.id), name: row.name };
}

export async function updateClub(id: string, data: { name: string }, _accessToken?: string) {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { data: row, error } = await supabaseAdmin
    .from('clubs')
    .update({ name: data.name })
    .eq('id', id)
    .select('id, name')
    .single();
  if (error || !row) throw new Error('Ошибка обновления клуба');
  return { _id: String(row.id), name: row.name };
}

export async function deleteClub(id: string, _accessToken?: string) {
  const user = await getCurrentUser();
  requireAdmin(user);
  const { error } = await supabaseAdmin.from('clubs').delete().eq('id', id);
  if (error) throw new Error('Ошибка удаления клуба');
  return { success: true };
}
