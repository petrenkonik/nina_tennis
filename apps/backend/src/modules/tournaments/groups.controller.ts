import { Controller, Get, Param, Post, Body, Put, Delete, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GroupDocument } from './group.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MatchDocument } from './match.schema';
import { generateKnockoutBracket } from '@shared/utils';

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
  @UseGuards(JwtAuthGuard)
  async create(@Body() data: any) {
    return this.groupModel.create(data);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() data: any) {
    return this.groupModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string) {
    return this.groupModel.findByIdAndDelete(id).exec();
  }

  @Get(':id/matches')
  async getMatches(@Param('id') id: string) {
    const group = await this.groupModel.findById(id).populate({ path: 'matches', populate: ['player1', 'player2', 'winnerId'] }).exec();
    return group?.matches || [];
  }

  @Post(':id/matches')
  @UseGuards(JwtAuthGuard)
  async addMatch(@Param('id') id: string, @Body() data: any) {
    const match = await this.matchModel.create(data);
    await this.groupModel.findByIdAndUpdate(id, { $push: { matches: match._id } });
    return match;
  }

  @Put(':groupId/matches/:matchId')
  @UseGuards(JwtAuthGuard)
  async updateMatch(@Param('groupId') groupId: string, @Param('matchId') matchId: string, @Body() data: any) {
    return this.matchModel.findByIdAndUpdate(matchId, data, { new: true });
  }

  @Delete(':groupId/matches/:matchId')
  @UseGuards(JwtAuthGuard)
  async deleteMatch(@Param('groupId') groupId: string, @Param('matchId') matchId: string) {
    await this.groupModel.findByIdAndUpdate(groupId, { $pull: { matches: matchId } });
    return this.matchModel.findByIdAndDelete(matchId);
  }

  @Post(':id/generate-matches')
  @UseGuards(JwtAuthGuard)
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