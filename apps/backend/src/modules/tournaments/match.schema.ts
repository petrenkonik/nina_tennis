import { Schema, Document, Types } from 'mongoose';

export type CourtSide = 'left' | 'right';
export type ServerSide = 'left' | 'right' | null;

export interface MatchDocument extends Document {
  player1: Types.ObjectId | null;
  player2: Types.ObjectId | null;
  score?: string;
  status: 'scheduled' | 'in_progress' | 'finished' | 'canceled';
  scheduledAt?: Date;
  playedAt?: Date;
  winnerId?: Types.ObjectId;
  court: string;
  round?: number;
  /** Кто подаёт в текущем гейме — по стороне корта (для табло). */
  serverSide?: ServerSide;
  /** Расстановка игроков на корте: player1/player2 — слева/справа. */
  courtSide?: { p1: CourtSide; p2: CourtSide };
  /** Полный снимок состояния судейства (для восстановления после рефреша). */
  scoringState?: any;
  /** История очков (стороны 1/2) — для undo и точного восстановления. */
  pointHistory?: number[];
  /** Текущий судья матча (ref User). */
  refereeId?: Types.ObjectId | null;
  /** История всех, кто судил матч (ref User). */
  judgedBy?: Types.ObjectId[];
}

export const MatchSchema = new Schema<MatchDocument>({
  player1: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
  player2: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
  score: { type: String },
  status: { type: String, enum: ['scheduled', 'in_progress', 'finished', 'canceled'], required: true },
  scheduledAt: { type: Date },
  playedAt: { type: Date },
  winnerId: { type: Schema.Types.ObjectId, ref: 'Player' },
  court: { type: String, required: true },
  round: { type: Number },
  serverSide: { type: String, enum: ['left', 'right'], default: null },
  courtSide: {
    p1: { type: String, enum: ['left', 'right'] },
    p2: { type: String, enum: ['left', 'right'] },
  },
  scoringState: { type: Schema.Types.Mixed, default: null },
  pointHistory: { type: [Number], default: [] },
  refereeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  judgedBy: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
}, { _id: true });
 