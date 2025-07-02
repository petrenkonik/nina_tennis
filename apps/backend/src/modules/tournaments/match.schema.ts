import { Schema, Document, Types } from 'mongoose';

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
}); 