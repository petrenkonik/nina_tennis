import { Schema, Document, Types } from 'mongoose';

export interface TournamentDocument extends Document {
  name: string;
  startDate: Date;
  endDate: Date;
  clubId?: Types.ObjectId;
  groups: Types.ObjectId[];
  /** Судьи турнира (пользователи с ролью referee). */
  referees: Types.ObjectId[];
  /** Многоразовый токен приглашения судей. */
  refereeInviteToken?: string;
}

export const TournamentSchema = new Schema<TournamentDocument>({
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: false },
  groups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
  referees: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
  refereeInviteToken: { type: String, default: null },
}); 