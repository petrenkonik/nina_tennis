/**
 * Трансформации строк БД (snake_case) → формат, ожидаемый UI (camelCase, Mongo-стиль).
 *
 * Старый фронт (apps/frontend) работал с Mongo-объектами: _id, fullName, photoUrl,
 * player1 как объект, scoringState и т.д. Чтобы не переписывать весь UI, мы возвращаем
 * из api-функций объекты той же формы. Это — единственное место, где живёт маппинг.
 */
import type { Match, Player } from '@shared/models/tennis';
import type { MatchScoringState } from '@shared/scoring';

/** Сырая строка таблицы players. */
export interface PlayerRow {
  id: string | number;
  full_name: string;
  birth_year: number | null;
  gender: string | null;
  club: string | null;
  photo_url: string | null;
  rating: number | null;
}

export function toPlayer(row: PlayerRow | null | undefined): Player | null {
  if (!row) return null;
  return {
    _id: String(row.id),
    fullName: row.full_name,
    photoUrl: row.photo_url || undefined,
    club: row.club || undefined,
    gender: row.gender || undefined,
    birthYear: row.birth_year || undefined,
    rating: row.rating || undefined,
  };
}

/** Сырая строка view v_matches_full. */
export interface MatchFullRow {
  id: string | number;
  group_id: string | number | null;
  player1_id: string | number | null;
  player2_id: string | number | null;
  player1_name: string | null;
  player1_photo: string | null;
  player1_club: string | null;
  player2_name: string | null;
  player2_photo: string | null;
  player2_club: string | null;
  score: string | null;
  status: Match['status'];
  scheduled_at: string | null;
  played_at: string | null;
  winner_id: string | number | null;
  court: string | null;
  round: number | null;
  server_side: 'left' | 'right' | null;
  court_side_p1: 'left' | 'right' | null;
  court_side_p2: 'left' | 'right' | null;
  scoring_state: MatchScoringState | null;
  point_history: number[];
  referee_id: string | null;
  referee_email?: string | null;
  referee_first_name?: string | null;
  referee_last_name?: string | null;
  group_name?: string | null;
  tournament_id?: string | number | null;
}

export function toMatch(row: MatchFullRow | null | undefined): Match | null {
  if (!row) return null;
  const player1: Player | null =
    row.player1_id != null
      ? {
          _id: String(row.player1_id),
          fullName: row.player1_name || '',
          photoUrl: row.player1_photo || undefined,
          club: row.player1_club || undefined,
        }
      : null;
  const player2: Player | null =
    row.player2_id != null
      ? {
          _id: String(row.player2_id),
          fullName: row.player2_name || '',
          photoUrl: row.player2_photo || undefined,
          club: row.player2_club || undefined,
        }
      : null;

  return {
    _id: String(row.id),
    player1,
    player2,
    score: row.score || undefined,
    status: row.status,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
    playedAt: row.played_at ? new Date(row.played_at) : undefined,
    winnerId: row.winner_id != null ? String(row.winner_id) : undefined,
    round: row.round || undefined,
    court: row.court || '',
    serverSide: row.server_side || null,
    courtSide:
      row.court_side_p1 || row.court_side_p2
        ? {
            p1: (row.court_side_p1 as 'left' | 'right') || 'left',
            p2: (row.court_side_p2 as 'left' | 'right') || 'right',
          }
        : undefined,
    scoringState: row.scoring_state || null,
    pointHistory: row.point_history || [],
    groupId: row.group_id != null ? String(row.group_id) : undefined,
    refereeId: row.referee_id || null,
    // judgedBy не входит во view; подтягивается отдельно при необходимости
    judgedBy: [],
  };
}

/** Группа в формате UI. */
export interface GroupUINode {
  _id: string;
  name: string;
  players: any[];
  matches: any[];
  seededPlayers?: { player: string; seed: number }[];
}
