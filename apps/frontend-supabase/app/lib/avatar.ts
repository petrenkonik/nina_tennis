'use client';

/**
 * Клиентский модуль работы с аватарами игроков.
 *
 * Загрузка/удаление идут через Route Handler (POST/DELETE /api/players/[id]/avatar),
 * который использует service-role ключ и Supabase Storage (bucket player-avatars).
 *
 * Функции принимают accessToken для совместимости со старым UI (next-auth credentials),
 * но авторизация проверяется на сервере по сессии next-auth, поэтому токен фактически
 * не используется — Server Action/Route Handler сам знает текущего пользователя.
 */

/** URL аватара. В новой версии — абсолютный URL из Supabase Storage. */
export function getPlayerAvatarUrl(photoUrl: string): string {
  if (!photoUrl) return '';
  // photoUrl уже абсолютный (https://...supabase.co/storage/...) либо внешний URL
  return photoUrl;
}

export async function uploadPlayerAvatar(playerId: string, file: File, _accessToken?: string) {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await fetch(`/api/players/${playerId}/avatar`, { method: 'POST', body: formData });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || 'Ошибка загрузки аватара');
  }
  return res.json();
}

export async function deletePlayerAvatar(playerId: string, _accessToken?: string) {
  const res = await fetch(`/api/players/${playerId}/avatar`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Ошибка удаления аватара');
  return res.json();
}

/** API_URL — оставляем как пустую строку для совместимости со старым SimpleBracket. */
export const API_URL = '';
