'use server';

import { createSupabaseServer } from '../supabase/server';
import { requireAdmin, requireAuth } from '../permissions';
import { getCurrentUser } from '../session';

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
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
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

/**
 * Регистрация нового пользователя (первый — admin, назначается триггером БД).
 * Создаёт аккаунт в Supabase Auth; profile создаётся триггером handle_new_user.
 */
export async function createUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<UserUI> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
      },
    },
  });
  if (error || !data.user) {
    throw new Error(error?.message || 'Ошибка регистрации');
  }
  // Профиль уже создан триггером; подгрузим роль.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name, last_name')
    .eq('id', data.user.id)
    .maybeSingle();
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
  _accessToken?: string,
): Promise<UserUI> {
  const user = await getCurrentUser();
  requireAuth(user);
  const supabase = await createSupabaseServer();

  // Смена email/пароля — через Supabase Auth (текущий пользователь).
  if (data.email || data.password) {
    const { error: authErr } = await supabase.auth.updateUser({
      ...(data.email ? { email: data.email } : {}),
      ...(data.password ? { password: data.password } : {}),
    });
    if (authErr) {
      const e = new Error(authErr.message || 'Ошибка обновления') as Error & { status?: number };
      e.status = 409;
      throw e;
    }
  }

  // Имя/фамилия — в profiles.
  const patch: Record<string, unknown> = {};
  if (data.firstName !== undefined) patch.first_name = data.firstName;
  if (data.lastName !== undefined) patch.last_name = data.lastName;
  if (Object.keys(patch).length) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) throw new Error('Ошибка обновления профиля');
  }

  return getMyProfile();
}

/** Обновление пользователя администратором (имя, фамилия). */
export async function updateUser(
  id: string,
  data: { firstName?: string; lastName?: string },
  _accessToken?: string,
): Promise<UserUI> {
  const user = await getCurrentUser();
  requireAdmin(user);
  const supabase = await createSupabaseServer();

  const patch: Record<string, unknown> = {};
  if (data.firstName !== undefined) patch.first_name = data.firstName;
  if (data.lastName !== undefined) patch.last_name = data.lastName;

  const { data: row, error } = await supabase
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
