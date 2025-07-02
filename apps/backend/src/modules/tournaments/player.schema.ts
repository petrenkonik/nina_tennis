import { Schema, Document } from 'mongoose';

export interface PlayerDocument extends Document {
  fullName: string;
  birthYear: number;
  gender: 'М' | 'Ж';
  club: string;
  photoUrl: string;
  rating?: number;
}

export const PlayerSchema = new Schema<PlayerDocument>({
  fullName: { type: String, required: true },
  birthYear: { type: Number, required: true },
  gender: { type: String, enum: ['М', 'Ж'], required: true },
  club: { type: String, required: true },
  photoUrl: { type: String, required: true },
  rating: { type: Number },
}); 