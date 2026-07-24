import bcrypt from 'bcryptjs';
import { supabaseAdmin } from './supabase/admin';

/**
 * Аутентификация: проверка email+password по таблице profiles (Postgres).
 * Замена NestJS LocalAuthGuard + users.service.
 *
 * Пароли — bcrypt (10 раундов, как в apps/backend). Не используем нативный
 * Supabase Auth намеренно (см. план: next-auth остаётся поверх своего хранилища).
 */

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'referee';
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Проверяет логин/пароль. Возвращает пользователя или null.
 * Используется credentials-провайдером next-auth.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, password_hash, role, first_name, last_name')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) return null;

  const ok = await bcrypt.compare(password, data.password_hash);
  if (!ok) return null;

  return {
    id: data.id,
    email: data.email,
    role: data.role,
    firstName: data.first_name,
    lastName: data.last_name,
  };
}

/**
 * Регистрация нового пользователя.
 * Правило из apps/backend: первый пользователь становится admin.
 * Возвращает созданного пользователя (без хеша) или бросает ошибку.
 */
export async function registerUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<AuthUser> {
  const { email, password, firstName, lastName } = input;

  // Проверка уникальности email
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existing) {
    throw new Error('Пользователь с таким email уже существует');
  }

  // Первый пользователь — admin
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  const role: AuthUser['role'] = (count ?? 0) === 0 ? 'admin' : 'user';

  const passwordHash = await bcrypt.hash(password, 10);

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({
      email,
      password_hash: passwordHash,
      role,
      first_name: firstName || null,
      last_name: lastName || null,
    })
    .select('id, email, role, first_name, last_name')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Ошибка регистрации');
  }

  return {
    id: data.id,
    email: data.email,
    role: data.role,
    firstName: data.first_name,
    lastName: data.last_name,
  };
}
