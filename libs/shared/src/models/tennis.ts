// Основные интерфейсы для теннисного турнира
import { Group } from './group';
import type { MatchScoringState } from '../scoring';

export interface Player {
  _id?: string;
  fullName: string;
  photoUrl?: string;
  club?: string;
  seed?: number;
  gender?: string;
  birthYear?: number;
  rating?: number;
}

export interface Match {
  _id: string;
  /** id группы, к которой привязан матч (для публичного табло). */
  groupId?: string;
  player1: Player | null; // null если bye; в парном матче — капитан стороны 1
  player2: Player | null; // в парном матче — капитан стороны 2
  /** Партнёр стороны 1 (только парные матчи; иначе null/undefined). */
  player3?: Player | null;
  /** Партнёр стороны 2 (только парные матчи; иначе null/undefined). */
  player4?: Player | null;
  score?: string; // "6:4, 7:5"
  status: 'scheduled' | 'in_progress' | 'finished' | 'canceled';
  scheduledAt?: Date;
  playedAt?: Date;
  winnerId?: string; // id победителя
  round?: number;
  court: string;
  /** Кто подаёт в текущем гейме — по стороне корта. */
  serverSide?: 'left' | 'right' | null;
  /** Расстановка игроков на корте: player1/player2 — слева/справа. */
  courtSide?: { p1: 'left' | 'right'; p2: 'left' | 'right' };
  /** Полный снимок состояния судейства (для восстановления после рефреша). */
  scoringState?: MatchScoringState | null;
  /** История очков (стороны 1/2) — для undo и точного восстановления. */
  pointHistory?: number[];
  /** Текущий судья матча (id пользователя, populate → объект). */
  refereeId?: string | { _id: string; email?: string; firstName?: string; lastName?: string } | null;
  /** История всех, кто судил матч (id пользователей, populate → объекты). */
  judgedBy?: Array<string | { _id: string; email?: string; firstName?: string; lastName?: string }>;
}

export interface Tournament {
  _id: string;
  name: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  clubId?: string;
  /** Формат турнира: одиночный (по умолчанию) или парный. */
  format?: 'singles' | 'doubles';
  groups: Group[];
}

export interface BracketNode {
  match: Match;
  nextMatchId?: string; // id следующего матча в сетке
  round: number;
}

export interface StandingsEntry {
  player: Player;
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  points: number;
  position: number;
}

