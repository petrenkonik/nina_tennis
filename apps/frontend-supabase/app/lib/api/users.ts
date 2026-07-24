'use server';

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../supabase/admin';
import { requireAdmin, requireAuth } from '../permissions';
import { getCurrentUser } from '../session';
import { registerUser } from '../auth';

/** Пользователи / профиль. Замена NestJS UsersController + AuthController.register. */

export interface UserUI {
  _id: string;
  id: string;
  email: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
}

/** Текущий профиль. */
export async function getMyProfile(_accessToken?: string): Promise<UserUI> {
  const user = await getCurrentUser();
  requireAuth(user);
  const { data, error } = await supabaseAdmin
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

/** Регистрация нового пользователя (первый — admin). */
export async function createUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<UserUI> {
  const u = await registerUser(input);
  return { _id: u.id, id: u.id, email: u.email, role: u.role, firstName: u.firstName, lastName: u.lastName };
}

/** Обновление собственного профиля. */
export async function updateMyProfile(
  data: { firstName?: string; lastName?: string; email?: string; password?: string },
  _accessToken?: string,
): Promise<UserUI> {
  const user = await getCurrentUser();
  requireAuth(user);

  // Проверка уникальности email при смене
  if (data.email && data.email !== user.email) {
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', data.email)
      .maybeSingle();
    if (existing) {
      const e = new Error('Email уже используется') as Error & { status?: number };
      e.status = 409;
      throw e;
    }
  }

  const patch: Record<string, unknown> = {};
  if (data.firstName !== undefined) patch.first_name = data.firstName;
  if (data.lastName !== undefined) patch.last_name = data.lastName;
  if (data.email !== undefined) patch.email = data.email;
  if (data.password) patch.password_hash = await bcrypt.hash(data.password, 10);

  const { data: row, error } = await supabaseAdmin
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('id, email, role, first_name, last_name')
    .single();
  if (error || !row) throw new Error('Ошибка обновления профиля');
  return {
    _id: row.id,
    id: row.id,
    email: row.email,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
  };
}

/** Обновление пользователя администратором (имя, фамилия). */
export async function updateUser(
  id: string,
  data: { firstName?: string; lastName?: string },
  _accessToken?: string,
): Promise<UserUI> {
  const user = await getCurrentUser();
  requireAdmin(user);

  const patch: Record<string, unknown> = {};
  if (data.firstName !== undefined) patch.first_name = data.firstName;
  if (data.lastName !== undefined) patch.last_name = data.lastName;

  const { data: row, error } = await supabaseAdmin
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
