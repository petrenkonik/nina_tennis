import { Schema, Document, Types } from 'mongoose';
import { Group } from '@shared/models/group';

export interface GroupDocument extends Document {
  name: string;
  players: Types.ObjectId[];
  matches: Types.ObjectId[];
  seededPlayers: { player: Types.ObjectId; seed: number }[];
}

export const GroupSchema = new Schema<GroupDocument>({
  name: { type: String, required: true },
  players: [{ type: Schema.Types.ObjectId, ref: 'Player', default: [] }],
  matches: [{ type: Schema.Types.ObjectId, ref: 'Match', default: [] }],
  seededPlayers: [{
    player: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    seed: { type: Number, required: true },
  }],
});


