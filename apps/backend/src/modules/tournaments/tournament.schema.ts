import { Schema, Document, Types } from 'mongoose';

export interface TournamentDocument extends Document {
  name: string;
  startDate: Date;
  endDate: Date;
  clubId?: Types.ObjectId;
  groups: Types.ObjectId[];
}

export const TournamentSchema = new Schema<TournamentDocument>({
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: false },
  groups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
}); 