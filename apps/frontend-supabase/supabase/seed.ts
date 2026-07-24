/**
 * Seed демо-данных для Supabase-версии.
 * Перенос apps/backend/src/seed.ts под Supabase Postgres.
 *
 * Запуск: npm run seed
 * Требует .env.local с SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (или переменные окружения).
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Требуются SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function clearAll() {
  // Порядок важен из-за FK; но ON DELETE CASCADE почистит зависимые.
  await supabase.from('match_judges').delete().neq('match_id', 0);
  await supabase.from('matches').delete().neq('id', 0);
  await supabase.from('group_seeds').delete().neq('group_id', 0);
  await supabase.from('group_players').delete().neq('group_id', 0);
  await supabase.from('groups').delete().neq('id', 0);
  await supabase.from('tournament_referees').delete().neq('tournament_id', 0);
  await supabase.from('tournaments').delete().neq('id', 0);
  await supabase.from('players').delete().neq('id', 0);
  await supabase.from('clubs').delete().neq('id', 0);
  await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Таблицы очищены');
}

async function seed() {
  await clearAll();

  // --- admin ---
  const passwordHash = await bcrypt.hash('admin', 10);
  const { data: admin } = await supabase
    .from('profiles')
    .insert({ email: 'admin', password_hash: passwordHash, role: 'admin', first_name: 'Admin', last_name: 'User' })
    .select('id')
    .single();
  console.log('Создан admin:', admin?.id);

  // --- клубы ---
  const clubNames = ['Победа', 'Олимп', 'Геленджик', 'Анапа'];
  const { data: clubs } = await supabase
    .from('clubs')
    .insert(clubNames.map((name) => ({ name })))
    .select('id, name');

  // --- игроки (37) ---
  const playersInput = [];
  for (let i = 1; i <= 37; i++) {
    const club = clubs![i % clubs!.length];
    playersInput.push({
      full_name: `Игрок${i} Фамилия${i}`,
      birth_year: 2000 + (i % 10),
      gender: i % 2 === 0 ? 'М' : 'Ж',
      club: club.name,
      // Аватарка через ui-avatars (внешний URL, без скачивания файлов)
      photo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(`Игрок ${i}`)}&background=random&size=128`,
      rating: Math.floor(Math.random() * 1000),
    });
  }
  const { data: createdPlayers } = await supabase.from('players').insert(playersInput).select('id');
  const playerIds = (createdPlayers || []).map((p) => p.id);

  // --- группы ---
  const { data: g1row } = await supabase.from('groups').insert({ name: 'U18-М' }).select('id').single();
  const { data: g2row } = await supabase.from('groups').insert({ name: 'U21-Ж' }).select('id').single();
  const group1Id = g1row!.id;
  const group2Id = g2row!.id;

  // Игроки в группы
  const group1Players = playerIds.slice(0, 13);
  const group2Players = playerIds.slice(13, 37);
  await supabase.from('group_players').insert(group1Players.map((player_id) => ({ group_id: group1Id, player_id })));
  await supabase.from('group_players').insert(group2Players.map((player_id) => ({ group_id: group2Id, player_id })));

  // Посев: первые 4 игрока каждой группы
  await supabase.from('group_seeds').insert(
    group1Players.slice(0, 4).map((player_id, idx) => ({ group_id: group1Id, player_id, seed: idx + 1 })),
  );
  await supabase.from('group_seeds').insert(
    group2Players.slice(0, 4).map((player_id, idx) => ({ group_id: group2Id, player_id, seed: idx + 1 })),
  );

  // --- турниры ---
  const club0 = clubs![0];
  const club1 = clubs![1];
  const { data: tournaments } = await supabase
    .from('tournaments')
    .insert([
      { name: 'Кубок Весны', start_date: '2024-05-01', end_date: '2024-05-10', club_id: club0.id },
      { name: 'Летний Турнир', start_date: '2024-06-15', end_date: '2024-06-25', club_id: club0.id },
      {
        name: 'Осенний Кубок',
        start_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 37).toISOString(),
        club_id: club1.id,
      },
    ])
    .select('id, name');

  // Привязываем group1 и group2 к первому турниру
  const t1Id = tournaments![0].id;
  await supabase.from('groups').update({ tournament_id: t1Id }).in('id', [group1Id, group2Id]);

  // --- матчи для group1 (3 раунда, как в оригинальном seed) ---
  const matchPlayers = group1Players.slice(0, 16);
  const r1: any[] = [];
  for (let i = 0; i < 8; i++) {
    r1.push({
      group_id: group1Id,
      player1_id: matchPlayers[i * 2],
      player2_id: matchPlayers[i * 2 + 1],
      score: '6-0 6-0',
      status: 'finished',
      scheduled_at: new Date().toISOString(),
      played_at: new Date().toISOString(),
      winner_id: matchPlayers[i * 2],
      round: 1,
      court: `Корт ${i + 1}`,
    });
  }
  const { data: createdR1 } = await supabase.from('matches').insert(r1).select('id, winner_id');

  const r2: any[] = [];
  for (let i = 0; i < 4; i++) {
    const w1 = createdR1![i * 2].winner_id;
    const w2 = createdR1![i * 2 + 1].winner_id;
    r2.push({
      group_id: group1Id,
      player1_id: w1,
      player2_id: w2,
      score: '6-2 6-2',
      status: 'finished',
      scheduled_at: new Date().toISOString(),
      played_at: new Date().toISOString(),
      winner_id: w1,
      round: 2,
      court: `Корт ${i + 1}`,
    });
  }
  const { data: createdR2 } = await supabase.from('matches').insert(r2).select('id, winner_id');

  const r3: any[] = [];
  for (let i = 0; i < 2; i++) {
    const w1 = createdR2![i * 2].winner_id;
    const w2 = createdR2![i * 2 + 1].winner_id;
    r3.push({
      group_id: group1Id,
      player1_id: w1,
      player2_id: w2,
      score: '6-4 6-4',
      status: 'finished',
      scheduled_at: new Date().toISOString(),
      played_at: new Date().toISOString(),
      winner_id: w1,
      round: 3,
      court: `Корт ${i + 1}`,
    });
  }
  await supabase.from('matches').insert(r3);

  console.log('Seed завершён!');
  console.log(`Игроков: ${playerIds.length}, Турниров: ${tournaments!.length}`);
  console.log('Логин: admin / пароль: admin');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
