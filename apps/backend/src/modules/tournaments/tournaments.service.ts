import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TournamentDocument } from './tournament.schema';
import { MatchDocument } from './match.schema';
import { PlayerDocument } from './player.schema';
import { GroupDocument } from './group.schema';

@Injectable()
export class TournamentsService {
  constructor(
    @InjectModel('Tournament') private tournamentModel: Model<TournamentDocument>,
    @InjectModel('Match') private matchModel: Model<MatchDocument>,
    @InjectModel('Player') private playerModel: Model<PlayerDocument>,
    @InjectModel('Group') private groupModel: Model<GroupDocument>,
  ) {}

  async findAll() {
    // Получаем турниры с группами и игроками в группах
    const tournaments = await this.tournamentModel.find().populate({
      path: 'groups',
      populate: { path: 'players' }
    }).exec();
    // Для каждого турнира считаем количество групп и уникальных игроков
    return tournaments.map((t: any) => {
      const groups = t.groups || [];
      const groupsCount = groups.length;
      // Собираем всех игроков из всех групп
      const allPlayers = groups.flatMap((g: any) => g.players || []);
      // Уникальные игроки по id
      const uniquePlayerIds = new Set(allPlayers.map((p: any) => String(p._id)));
      const playersCount = uniquePlayerIds.size;
      // Возвращаем расширенный объект
      return {
        ...t.toObject(),
        groupsCount,
        playersCount,
      };
    });
  }

  async findById(id: string) {
    return this.tournamentModel.findById(id).populate('groups').exec();
  }

  async create(data: Partial<TournamentDocument>) {
    return this.tournamentModel.create(data);
  }

  async update(id: string, data: Partial<TournamentDocument>) {
    return this.tournamentModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string) {
    return this.tournamentModel.findByIdAndDelete(id).exec();
  }

  async generateBracket(groupId: string) {
    // Получаем группу и всех игроков
    const group = await this.groupModel.findById(groupId).populate('players');
    if (!group) throw new Error('Group not found');
    const players: PlayerDocument[] = group.players as any;
    // Перемешиваем игроков (рандом)
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
    // Удаляем старые матчи группы
    await this.matchModel.deleteMany({ _id: { $in: group.matches } });
    group.matches = [];
    await group.save();
    // Генерируем сетку single elimination
    let roundPlayers = players;
    let round = 1;
    const allMatchIds: Types.ObjectId[] = [];
    while (roundPlayers.length > 1) {
      const matches: any[] = [];
      for (let i = 0; i < roundPlayers.length; i += 2) {
        const player1 = roundPlayers[i];
        const player2 = roundPlayers[i + 1] || null;
        const match = await this.matchModel.create({
          player1: player1?._id || null,
          player2: player2?._id || null,
          isStarted: false,
          isCompleted: false,
          court: '',
          round,
        });
        matches.push(match);
        allMatchIds.push(match._id as Types.ObjectId);
      }
      roundPlayers = new Array(Math.ceil(roundPlayers.length / 2)).fill(null);
      round++;
    }
    group.matches = allMatchIds;
    await group.save();
    return { success: true, matchesCreated: allMatchIds.length };
  }

  async getBracket(groupId: string) {
    const group = await this.groupModel.findById(groupId)
      .populate({ path: 'matches', populate: ['player1', 'player2'] })
      .populate('seededPlayers.player');
    if (!group || !group.matches.length) return { rounds: [] };
    const matches = group.matches as any[];
    const maxRound = Math.max(...matches.map((m: any) => m.round || 1));
    const rounds = [];
    for (let r = 1; r <= maxRound; r++) {
      const roundMatches = matches.filter((m: any) => m.round === r);
      rounds.push({
        title: `Раунд ${r}`,
        seeds: roundMatches.map((m: any) => {
          // Получаем seed для player1 и player2
          const seed1 = group.seededPlayers?.find((s: any) => s.player && m.player1 && String(s.player._id || s.player) === String(m.player1._id || m.player1))?.seed;
          const seed2 = group.seededPlayers?.find((s: any) => s.player && m.player2 && String(s.player._id || s.player) === String(m.player2._id || m.player2))?.seed;
          return {
            id: m._id,
            teams: [
              m.player1 ? {
                _id: m.player1._id,
                fullName: m.player1.fullName,
                photoUrl: m.player1.photoUrl,
                club: m.player1.club,
                seed: seed1,
              } : { name: 'BYE' },
              m.player2 ? {
                _id: m.player2._id,
                fullName: m.player2.fullName,
                photoUrl: m.player2.photoUrl,
                club: m.player2.club,
                seed: seed2,
              } : { name: 'BYE' },
            ],
            score: m.score,
            scheduledAt: m.scheduledAt,
            playedAt: m.playedAt,
            winner: m.winnerId,
            court: m.court,
            status: m.status, 
          };
        }),
      });
    }
    return { rounds };
  }
} 