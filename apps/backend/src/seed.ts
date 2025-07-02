import mongoose from 'mongoose';
import { UserSchema } from './modules/users/schemas/user.schema';
import { TournamentSchema } from './modules/tournaments/tournament.schema';
import { GroupSchema } from './modules/tournaments/group.schema';
import { PlayerSchema } from './modules/tournaments/player.schema';
import { MatchSchema } from './modules/tournaments/match.schema';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/projectdb';

async function seed() {
  await mongoose.connect(MONGO_URI);

  // Модели
  const User = mongoose.model('User', UserSchema);
  const Tournament = mongoose.model('Tournament', TournamentSchema);
  const Group = mongoose.model('Group', GroupSchema);
  const Player = mongoose.model('Player', PlayerSchema);
  const Club = mongoose.model('Club', require('./modules/tournaments/club.schema').ClubSchema);
  const Match = mongoose.model('Match', MatchSchema);

  // Очистка
  await User.deleteMany({});
  await Tournament.deleteMany({});
  await Group.deleteMany({});
  await Player.deleteMany({});
  await Club.deleteMany({});
  await Match.deleteMany({});

  // Тестовый пользователь
  await User.create({
    email: 'admin',
    password: await require('bcryptjs').hash('admin', 10), // Пароль захеширован
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User',
  });

  // Тестовые группы
  const group1 = await Group.create({ name: 'U18-М', players: [], matches: [] });
  const group2 = await Group.create({ name: 'U21-Ж', players: [], matches: [] });

  // Клубы
  const clubNames = ['Победа', 'Олимп', 'Геленджик', 'Анапа'];
  const clubs = await Club.insertMany(clubNames.map(name => ({ name })));

  // Кросс-платформенное определение директории
  const baseDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(process.argv[1]);
  const photosDir = path.resolve(baseDir, '../player_photos');
  console.log('baseDir:', baseDir);
  console.log('photosDir:', photosDir);
  if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir);
  }

  // Генерация игроков
  const players: any[] = [];
  for (let i = 1; i <= 37; i++) {
    const club = clubs[i % clubs.length];
    const photoFileName = `player${i}.jpg`;
    const photoPath = path.join(photosDir, photoFileName);

    // Генерируем аватарку через ui-avatars
    if (!fs.existsSync(photoPath)) {
      const url = `https://ui-avatars.com/api/?name=Игрок+${i}&background=random&size=128`;
      try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(photoPath, response.data);
      } catch (e) {
        console.error('Ошибка скачивания аватарки:', url, e);
        fs.writeFileSync(photoPath, Buffer.from([])); // fallback: пустой файл
      }
    }

    players.push({
      fullName: `Игрок${i} Фамилия${i}`,
      birthYear: 2000 + (i % 10),
      gender: i % 2 === 0 ? 'М' : 'Ж',
      club: club.name,
      photoUrl: `/player_photos/${photoFileName}`,
      rating: Math.floor(Math.random() * 1000),
    });
  }
  const createdPlayers = await Player.insertMany(players);

  // Привязка игроков к группам
  const group1Players = createdPlayers.slice(0, 13).map(p => p._id);
  const group2Players = createdPlayers.slice(13, 37).map(p => p._id);
  group1.players = group1Players;
  group2.players = group2Players;
  group1.seededPlayers = group1Players.slice(0, 4).map((playerId, idx) => ({ player: playerId, seed: idx + 1 }));
  group2.seededPlayers = group2Players.slice(0, 4).map((playerId, idx) => ({ player: playerId, seed: idx + 1 }));
  await group1.save();

  // СИД ДЛЯ МАТЧЕЙ (8 матчей первого раунда)
  const matchPlayers = group1Players.slice(0, 16);
  const matches = [];
  // Первый раунд (8 матчей)
  for (let i = 0; i < 8; i++) {
    matches.push({
      player1: matchPlayers[i * 2],
      player2: matchPlayers[i * 2 + 1],
      score: '6-0 6-0',
      status: 'finished',
      scheduledAt: new Date(),
      playedAt: new Date(),
      winnerId: matchPlayers[i * 2],
      round: 1,
      court: `Корт ${i + 1}`,
    });
  }
  const createdMatches1 = await Match.insertMany(matches);

  // Второй раунд (4 матча, победители первого раунда)
  const matches2 = [];
  for (let i = 0; i < 4; i++) {
    matches2.push({
      player1: createdMatches1[i * 2].winnerId,
      player2: createdMatches1[i * 2 + 1].winnerId,
      score: '6-2 6-2',
      status: 'finished',
      scheduledAt: new Date(),
      playedAt: new Date(),
      winnerId: createdMatches1[i * 2].winnerId,
      round: 2,
      court: `Корт ${i + 1}`,
    });
  }
  const createdMatches2 = await Match.insertMany(matches2);

  // Третий раунд (2 матча, победители второго раунда)
  const matches3 = [];
  for (let i = 0; i < 2; i++) {
    matches3.push({
      player1: createdMatches2[i * 2].winnerId,
      player2: createdMatches2[i * 2 + 1].winnerId,
      score: '6-4 6-4',
      status: 'finished',
      scheduledAt: new Date(),
      playedAt: new Date(),
      winnerId: createdMatches2[i * 2].winnerId,
      round: 3,
      court: `Корт ${i + 1}`,
    });
  }
  const createdMatches3 = await Match.insertMany(matches3);

  // Обновляем group1.matches (все матчи всех раундов)
  group1.matches = [
    ...createdMatches1.map(m => m._id),
    ...createdMatches2.map(m => m._id),
    ...createdMatches3.map(m => m._id),
  ];
  await group1.save();

  // Тестовые турниры с группами
  await Tournament.create([
    {
      name: 'Кубок Весны',
      startDate: new Date('2024-05-01'),
      endDate: new Date('2024-05-10'),
      groups: [group1._id, group2._id],
      clubId: clubs[0]._id,
    },
    {
      name: 'Летний Турнир',
      startDate: new Date('2024-06-15'),
      endDate: new Date('2024-06-25'),
      groups: [],
      clubId: clubs[0]._id,
    },
    // Новый турнир в будущем
    {
      name: 'Осенний Кубок',
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // через 30 дней
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 37), // через 37 дней
      groups: [group1._id],
      clubId: clubs[1]._id,
    },
  ]);

  // Вывод количества документов
  const playerCount = await Player.countDocuments();
  const groupCount = await Group.countDocuments();
  const tournamentCount = await Tournament.countDocuments();
  const matchCount = await Match.countDocuments();
  console.log(`Players: ${playerCount}, Groups: ${groupCount}, Tournaments: ${tournamentCount}, Matches: ${matchCount}`);

  console.log('Seed complete!');
  await mongoose.disconnect();
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
}); 