import { Controller, Get, Param, Post, Body, Put, Delete, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GroupDocument } from './group.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MatchDocument } from './match.schema';

/**
 * Генерирует олимпийскую (playoff) сетку для заданного списка игроков с учётом посева
 * @param players Список игроков (Player[]), у которых seed — номер посева (1 — самый сильный)
 * @returns Массив раундов, каждый из которых — массив матчей
 */
function generateKnockoutBracket(players: any[]): any[][] {
  if (!players || players.length === 0) return [];
  // Сортируем по посеву: seed=1,2,3... в начало, остальные в случайном порядке
  const seeded = players.filter(p => typeof p.seed === 'number').sort((a, b) => a.seed - b.seed);
  const unseeded = players.filter(p => typeof p.seed !== 'number');
  // Перемешиваем несеяных
  for (let i = unseeded.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unseeded[i], unseeded[j]] = [unseeded[j], unseeded[i]];
  }
  // Итоговый список: посеянные + несеяные
  const all = [...seeded, ...unseeded];
  // Следующее число степени двойки >= n
  function nextPow2(n: number) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
  const total = nextPow2(all.length);
  const byes = total - all.length;
  // Распределяем игроков по сетке (алгоритм "snake seeding")
  const slots = Array(total).fill(null);
  // snake seeding: 1 vs last, 2 vs last-1, 3 vs last-2 ...
  let left = 0, right = total - 1, idx = 0;
  while (left < right && idx < all.length) {
    slots[left++] = all[idx++];
    if (idx < all.length) slots[right--] = all[idx++];
  }
  if (left === right && idx < all.length) slots[left] = all[idx++];
  // Первый раунд
  const rounds: any[][] = [];
  let current = [];
  for (let i = 0; i < total; i += 2) {
    current.push({
      player1: slots[i],
      player2: slots[i + 1],
      round: 1,
      status: 'scheduled',
    });
  }
  rounds.push(current);
  // Генерируем следующие раунды (кол-во матчей делится на 2)
  let matches = current.length;
  let roundNum = 2;
  while (matches > 1) {
    const nextRound = [];
    for (let i = 0; i < matches / 2; i++) {
      nextRound.push({
        player1: null,
        player2: null,
        round: roundNum,
        status: 'scheduled',
      });
    }
    rounds.push(nextRound);
    matches = nextRound.length;
    roundNum++;
  }
  return rounds;
}

@Controller('groups')
export class GroupsController {
  constructor(
    @InjectModel('Group') private groupModel: Model<GroupDocument>,
    @InjectModel('Match') private matchModel: Model<MatchDocument>,
  ) {}

  @Get()
  async findAll() {
    return this.groupModel.find().populate('players').exec();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.groupModel.findById(id).populate('players').exec();
  }

  @Get(':id/players')
  async getPlayers(@Param('id') id: string) {
    const group = await this.groupModel.findById(id).populate('players').exec();
    return group?.players || [];
  }
  @Get(':id/players/seeded')
  async getSeededPlayers(@Param('id') id: string) {
    const group = await this.groupModel.findById(id).populate({ path: 'seededPlayers.player' }).exec();
    return group?.seededPlayers || [];
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() data: any) {
    return this.groupModel.create(data);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.groupModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string) {
    return this.groupModel.findByIdAndDelete(id).exec();
  }

  @Get(':id/matches')
  async getMatches(@Param('id') id: string) {
    const group = await this.groupModel.findById(id).populate({ path: 'matches', populate: ['player1', 'player2', 'winnerId'] }).exec();
    return group?.matches || [];
  }

  @Post(':id/matches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async addMatch(@Param('id') id: string, @Body() data: any) {
    const match = await this.matchModel.create(data);
    await this.groupModel.findByIdAndUpdate(id, { $push: { matches: match._id } });
    return match;
  }

  @Put(':groupId/matches/:matchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateMatch(@Param('groupId') groupId: string, @Param('matchId') matchId: string, @Body() data: any) {
    return this.matchModel.findByIdAndUpdate(matchId, data, { new: true });
  }

  @Delete(':groupId/matches/:matchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteMatch(@Param('groupId') groupId: string, @Param('matchId') matchId: string) {
    await this.groupModel.findByIdAndUpdate(groupId, { $pull: { matches: matchId } });
    return this.matchModel.findByIdAndDelete(matchId);
  }

  @Post(':id/generate-matches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async generateMatches(@Param('id') id: string) {
    const group = await this.groupModel.findById(id).populate('players').exec();
    if (!group) throw new Error('Group not found');
    // Получаем игроков с seed (если есть)
    const players = group.players.map((p: any) => {
      const seedObj = (group.seededPlayers || []).find((s: any) => String(s.player) === String(p._id));
      return seedObj ? { ...p.toObject(), seed: seedObj.seed } : p.toObject();
    });
    // Генерируем сетку (все раунды, включая пустые)
    const rounds = generateKnockoutBracket(players);
    // Сохраняем все матчи в базу
    const matchDocs = [];
    for (const round of rounds) {
      for (const m of round) {
        const match = await this.matchModel.create({
          player1: m.player1?._id || null,
          player2: m.player2?._id || null,
          round: m.round,
          status: 'scheduled',
          court: '',
        });
        matchDocs.push(match._id);
      }
    }
    // Привязываем матчи к группе
    group.matches = matchDocs;
    await group.save();
    return await this.groupModel.findById(id).populate({ path: 'matches', populate: ['player1', 'player2', 'winnerId'] }).exec();
  }
} 