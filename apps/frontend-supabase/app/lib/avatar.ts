'use client';

/**
 * Клиентский модуль работы с аватарами игроков.
 *
 * Загрузка/удаление идут напрямую в Supabase Storage через supabaseBrowser
 * (bucket player-avatars, публичное чтение + запись авторизованным по RLS).
 * photo_url игрока обновляется через setPlayerPhotoUrl (RLS: запись админом).
 */

import { supabaseBrowser } from './supabase/browser';
import { setPlayerPhotoUrl } from './client';

const BUCKET = 'player-avatars';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** URL аватара. В новой версии — абсолютный URL из Supabase Storage. */
export function getPlayerAvatarUrl(photoUrl: string): string {
  if (!photoUrl) return '';
  return photoUrl;
}

export async function uploadPlayerAvatar(playerId: string, file: File) {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Допустимы только изображения (JPEG, PNG, WebP)');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Файл слишком большой (макс. 2MB)');
  }

  const supabase = supabaseBrowser;
  const ext = file.type.split('/')[1];
  const path = `${playerId}/avatar-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) throw new Error('Ошибка загрузки в Storage');

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const photoUrl = pub.publicUrl;

  await setPlayerPhotoUrl(playerId, photoUrl);
  return { success: true, photoUrl };
}

export async function deletePlayerAvatar(playerId: string) {
  const supabase = supabaseBrowser;
  const { data: list } = await supabase.storage.from(BUCKET).list(playerId);
  if (list && list.length) {
    await supabase.storage.from(BUCKET).remove(list.map((f) => `${playerId}/${f.name}`));
  }
  await setPlayerPhotoUrl(playerId, null);
  return { success: true };
}

/** API_URL — оставляем как пустую строку для совместимости со старым SimpleBracket. */
export const API_URL = '';
