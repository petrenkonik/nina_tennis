import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabaseAdmin } from 'app/lib/supabase/admin';
import { authOptions } from 'app/lib/authOptions';
import { setPlayerPhotoUrl } from 'app/lib/api/players';

export const runtime = 'nodejs';

const BUCKET = 'player-avatars';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Загрузка аватара игрока в Supabase Storage + обновление photo_url. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Требуются права администратора' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('avatar');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Допустимы только изображения (JPEG, PNG, WebP)' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Файл слишком большой (макс. 2MB)' }, { status: 400 });
  }

  const ext = file.type.split('/')[1];
  const path = `${id}/avatar-${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });
  if (upErr) {
    return NextResponse.json({ error: 'Ошибка загрузки в Storage' }, { status: 500 });
  }

  // Публичный URL (bucket публичный для чтения аватаров)
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const photoUrl = pub.publicUrl;

  await setPlayerPhotoUrl(id, photoUrl);
  return NextResponse.json({ success: true, photoUrl });
}

/** Удаление аватара игрока. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Требуются права администратора' }, { status: 403 });
  }

  // Список файлов игрока и удаление
  const { data: list } = await supabaseAdmin.storage.from(BUCKET).list(id);
  if (list && list.length) {
    await supabaseAdmin.storage.from(BUCKET).remove(list.map((f) => `${id}/${f.name}`));
  }
  await setPlayerPhotoUrl(id, null);
  return NextResponse.json({ success: true });
}
