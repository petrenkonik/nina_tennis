// Основные интерфейсы для теннисного турнира
import { Group } from './group';

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
  player1: Player | null; // null если bye
  player2: Player | null;
  score?: string; // "6:4, 7:5"
  status: 'scheduled' | 'in_progress' | 'finished' | 'canceled';
  scheduledAt?: Date;
  playedAt?: Date;
  winnerId?: string; // id победителя
  round?: number;
  court: string;
}

export interface Tournament {
  _id: string;
  name: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  clubId?: string;
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

